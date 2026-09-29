"""Fit a selected-cohort random-slope distribution, not a clinical risk model.

Uses existing private_paired.csv, writes aggregate coefficients only. Repeated
eyes receive inverse patient-eye weights. Scan error is assumed, not estimated.
"""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from nkpi.projection import KEYS, VERSION, YEAR_DAYS, transform, noise_covariance


def fit(d, t, weights, noise, max_iter=10000):
    n, p = d.shape
    w = weights / weights.sum()
    slopes = d / t[:, None]
    mu = np.sum(w[:, None]*slopes, axis=0)
    centered = slopes-mu
    var = np.einsum('n,ni,nj->ij', w, centered, centered) + .01*np.eye(p)
    previous = -np.inf
    for iteration in range(max_iter):
        innovation = t[:, None, None]**2*var + 2*noise
        inverse = np.linalg.inv(innovation)
        gain = t[:, None, None]*np.einsum('ij,njk->nik', var, inverse)
        residual = d-t[:, None]*mu
        posterior_mean = mu + np.einsum('nij,nj->ni', gain, residual)
        posterior_var = var - t[:, None, None]*np.einsum('nij,jk->nik', gain, var)
        updated = np.sum(w[:, None]*posterior_mean, axis=0)
        centered = posterior_mean-updated
        v = np.einsum('n,nij->ij', w, posterior_var) + np.einsum('n,ni,nj->ij', w, centered, centered)
        v = (v+v.T)/2
        eig, vec = np.linalg.eigh(v)
        # Numerical PSD floor only, not a clinical regularization rule.
        v = (vec*np.maximum(eig,1e-7)) @ vec.T
        ll = float(-.5*np.sum(w*(np.linalg.slogdet(innovation)[1]+np.einsum('ni,nij,nj->n',residual,inverse,residual))))
        if ll < previous-1e-7:
            raise RuntimeError("EM likelihood decreased")
        mu, var = updated, v
        if iteration > 5 and abs(ll-previous)<1e-6:
            return mu, var, {"iterations":iteration+1,"weighted_log_likelihood_without_constant":ll,"converged":True}
        previous = ll
    raise RuntimeError("Conditional prior fitting did not converge")


def main():
    ap=argparse.ArgumentParser();ap.add_argument('private_csv');ap.add_argument('output');args=ap.parse_args()
    f=pd.read_csv(args.private_csv)
    f=f[f.age_baseline.between(18,50)&f.interval_years.between(90/YEAR_DAYS,5)].copy()
    if len(f)<30 or f.patient_id.nunique()<20:raise ValueError("Insufficient cohort")
    first=np.array([transform({k:r['baseline_'+k] for k in KEYS}) for _,r in f.iterrows()])
    last=np.array([transform({k:r['latest_'+k] for k in KEYS}) for _,r in f.iterrows()])
    if not np.isfinite(first).all() or not np.isfinite(last).all():raise ValueError("Invalid measurements")
    weights=1/f.groupby('patient_id').patient_id.transform('count').to_numpy()
    result={"version":VERSION,"status":"conditional_research_only","keys":list(KEYS),
            "cohort":{"eyes":len(f),"patients":int(f.patient_id.nunique()),"min_history_days":90,"max_history_years":5,"baseline_age_range":[18,50]},
            "source_workbook_sha256":"60bd4895f669fa55bd4e7e37266c66a52497f250847869185dfa1424bfa882be",
            "private_input_sha256":hashlib.sha256(Path(args.private_csv).read_bytes()).hexdigest(),
            "measurement_bounds":{k:[float(f[['baseline_'+k,'latest_'+k]].min().min()),float(f[['baseline_'+k,'latest_'+k]].max().max())] for k in KEYS},
            "noise_note":"Assumed pair 95% error limits are 0.5, 1 and 2 times SOURCE thresholds. They are NOT estimated repeatability limits. A fourth scenario has 0.5 shared measurement-error correlation in worsening coordinates.",
            "age_note":"Age defines fitting scope only. No unvalidated automatic age-related slowing is imposed.",
            "validation":"No third-scan validation. Selected retrospective CXL/control sample; not a representative natural-history cohort or calibrated risk model.","scenarios":[]}
    for key,name,factor,corr in [('low','Lower assumed noise',.5,0),('central','Central assumption',1,0),('high','Higher assumed noise',2,0),('correlated','Shared measurement error',1,.5)]:
        mu,var,diagnostic=fit(last-first,f.interval_years.to_numpy(),weights,noise_covariance(factor,corr))
        result['scenarios'].append(dict(key=key,name=name,noise_factor=factor,noise_correlation=corr,mean_slope=mu.tolist(),slope_covariance=var.tolist(),fit=diagnostic))
    out=Path(args.output);out.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n')
    out.with_suffix('.sha256').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'\n')
    print(json.dumps({'cohort':result['cohort'],'fits':[{**s['fit'],'scenario':s['key']} for s in result['scenarios']]}))

if __name__=='__main__':main()
