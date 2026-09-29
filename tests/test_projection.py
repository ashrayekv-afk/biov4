"""Engineering/statistical checks; these do NOT establish clinical validity."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

import numpy as np

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from nkpi import projection as P
from nkpi.service import calculate, configuration
from research.fit_conditional_projection import fit


def case(eye='OD',days=183):
    return dict(eye=eye,mode='longitudinal',age=24,verified=True,treatment='untreated',
                scan_quality={'first':'ok','latest':'ok'},interval_days=days,
                first=dict(A=7.2,B=5.9,C=500,Kmax=49,BAD_D=3,ARTmax=250),
                latest=dict(A=7.13,B=5.85,C=496,Kmax=49.6,BAD_D=3.43,ARTmax=240))


def result(c):
    return calculate({'eyes':[c]},include_pdf=False)['eyes'][c['eye']]


class ProjectionTests(unittest.TestCase):
    def test_no_noise_reduces_to_linear_extrapolation(self):
        v=np.eye(6)*2;mu=np.arange(6)*.1;d=np.arange(6)*.15
        mean,var=P.conditional_change(d,.25,.5,mu,v,np.zeros((6,6)))
        np.testing.assert_allclose(mean,2*d,atol=1e-12)
        np.testing.assert_allclose(var,0,atol=1e-12)

    def test_shared_latest_error_against_independent_simulation(self):
        # Simulate the full three-scan generative model, not the conditional code.
        rng=np.random.default_rng(785);n=180000;t=.25;h=.5
        mu=np.arange(6)*.1;v=.8*np.eye(6)+.2*np.ones((6,6));r=.12*np.eye(6)
        b=rng.multivariate_normal(mu,v,n)
        e=rng.multivariate_normal(np.zeros(6),r,(3,n))
        d=t*b+e[1]-e[0];future=h*b+e[2]-e[1]
        gain=(h*t*v-r)@np.linalg.inv(t*t*v+2*r)
        residual=future-(h*mu+(d-t*mu)@gain.T)
        _,var=P.conditional_change(np.zeros(6),t,h,mu,v,r)
        np.testing.assert_allclose(np.cov(residual,rowvar=False),var,atol=.007)
        self.assertLess(np.abs(np.cov(np.concatenate([residual,d],axis=1),rowvar=False)[:6,6:]).max(),.006)
        # With no intrinsic trend, an unusually high latest error reverses.
        mean,_=P.conditional_change(np.ones(6),1,.5,np.zeros(6),np.zeros((6,6)),np.eye(6))
        np.testing.assert_allclose(mean,-.5*np.ones(6))

    def test_fit_recovers_correlated_synthetic_slopes(self):
        rng=np.random.default_rng(789);n=1800;t=rng.uniform(.3,3,n)
        mu=np.array([.2,.1,.3,-.1,.4,.2]);v=.8*np.eye(6)+.25*np.ones((6,6));r=P.noise_covariance()
        slopes=rng.multivariate_normal(mu,v,n)
        d=t[:,None]*slopes+rng.multivariate_normal(np.zeros(6),2*r,n)
        m,c,diag=fit(d,t,np.ones(n),r)
        np.testing.assert_allclose(m,mu,atol=.09)
        np.testing.assert_allclose(c,v,atol=.14)
        self.assertTrue(diag['converged'])

    def test_covariance_psd_short_history_uncertainty(self):
        for s in P.artifact()[0]['scenarios']:
            v=np.array(s['slope_covariance']);r=P.noise_covariance(s['noise_factor'],s['noise_correlation'])
            self.assertGreater(np.linalg.eigvalsh(v).min(),0)
            for days in [1,30,54,90,183,365,1826]:
                _,var=P.conditional_change(np.ones(6),days/P.YEAR_DAYS,183/P.YEAR_DAYS,s['mean_slope'],v,r)
                self.assertGreaterEqual(np.linalg.eigvalsh(var).min(),-1e-9)
        _,short=P.conditional_change(np.ones(6),.1,.5,np.zeros(6),np.eye(6),np.eye(6)*.1)
        _,long=P.conditional_change(np.ones(6),1.,.5,np.zeros(6),np.eye(6),np.eye(6)*.1)
        self.assertGreater(np.trace(short),np.trace(long))

    def test_exact_thresholds_and_or_domain_votes(self):
        a=dict(A=7.2,B=5.9,C=500,Kmax=49,BAD_D=3,ARTmax=250)
        b=dict(A=7.094,B=5.815,C=490,Kmax=50,BAD_D=3.42,ARTmax=205.76)
        self.assertEqual(P.domain_flags(a,b),[False]*4)
        b.update(A=7.093,B=5.814,C=489,Kmax=51,BAD_D=3.43,ARTmax=205)
        self.assertEqual(P.domain_flags(a,b),[True]*4)
        self.assertEqual(P.draw_counts(np.ones((1,6)))[0],0)
        self.assertEqual(P.draw_counts(np.ones((1,6))*1.01)[0],4)

    def test_deterministic_bilateral_latest_reference_and_range(self):
        c=case();r=result(c);p=r['projection']
        self.assertEqual(p['status'],'ready')
        self.assertEqual(p,result(c)['projection'])
        self.assertEqual(p['input_sha256'],r['input_sha256'])
        self.assertEqual(p['observed_count'],1)
        for scenario in p['scenarios']:
            expected=P.domain_flags(c['latest'],scenario['projected_values'])
            self.assertEqual(scenario['count'],sum(expected))
        self.assertLessEqual(p['range'][0],p['central_count']);self.assertGreaterEqual(p['range'][1],p['central_count'])
        c2=case('OS',54)
        both=calculate({'eyes':[c,c2]},include_pdf=False)['eyes']
        self.assertEqual(both['OD']['projection'],p)
        self.assertNotEqual(both['OS']['projection']['input_sha256'],p['input_sha256'])
        self.assertNotEqual(both['OS']['projection']['central_count'],p['central_count'])
        self.assertEqual(both['OS']['projection']['eye'],'OS')
        self.assertNotIn('probability',p)
        # Editing one eye or the NKPI score must not alter another eye's projection.
        altered=copy.deepcopy(r);altered['prediction']['nkpi']=99
        self.assertEqual(P.project(altered,r['input_sha256']),p)

    def test_ineligible_unknown_and_missing_cases(self):
        for changes in [dict(treatment='treated'),dict(age=51),dict(interval_days=2000),
                        dict(verified=False),dict(scan_quality={'first':'warning','latest':'ok'}),
                        dict(mode='baseline'),dict(latest={**case()['latest'],'A':None}),
                        dict(latest={**case()['latest'],'C':210})]:
            c={**case(),**changes};p=result(c)['projection']
            self.assertEqual(p['status'],'unavailable',str(changes))
            self.assertNotIn('central_count',p)
        c=case();c['treatment']='unknown';c['scan_quality']={'first':'unknown','latest':'unknown'}
        p=result(c)['projection'];self.assertEqual(p['status'],'ready');self.assertEqual(len(p['warnings']),2)
        p=result(case(days=30))['projection'];self.assertTrue(any('Short history' in w for w in p['warnings']))

    def test_fitted_artifact_contract_and_corruption(self):
        data,sha=P.artifact();self.assertEqual(data['cohort']['eyes'],179);self.assertEqual(data['cohort']['patients'],101)
        self.assertEqual(configuration()['projection']['sha256'],sha)
        self.assertTrue(all(s['fit']['converged'] for s in data['scenarios']))
        original=P.ARTIFACT
        try:
            with tempfile.TemporaryDirectory() as td:
                p=Path(td)/'model.json';p.write_bytes(original.read_bytes()+b' ');p.with_suffix('.sha256').write_text(sha)
                P.ARTIFACT=p;P.artifact.cache_clear()
                with self.assertRaisesRegex(ValueError,'checksum'):P.artifact()
        finally:
            P.ARTIFACT=original;P.artifact.cache_clear()


if __name__=='__main__':unittest.main(verbosity=2)
