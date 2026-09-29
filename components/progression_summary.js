/* SOURCE P0175, pp. 3–4: prespecified domain thresholds, not a validated diagnosis.
 * These calculations do not read, weight or modify the NKPI score.
 */
(function(root){'use strict';
const S=typeof module!=='undefined'&&module.exports?require('./schema.js'):root.NKPI;
const E=S.esc;
const RULES=Object.freeze([
  {key:'anterior',name:'Anterior curvature',components:[{key:'A',direction:-1,threshold:.106,rule:'ARC decrease >0.106 mm'},{key:'Kmax',direction:1,threshold:1,rule:'Kmax increase >1.0 D'}]},
  {key:'posterior',name:'Posterior curvature',components:[{key:'B',direction:-1,threshold:.085,rule:'PRC decrease >0.085 mm'}]},
  {key:'pachymetric',name:'Pachymetric',components:[{key:'C',direction:-1,threshold:2,percent:true,rule:'Thickness decrease >2% of baseline'},{key:'ARTmax',direction:-1,threshold:44.24,rule:'ARTmax decrease >44.24 units'}]},
  {key:'composite',name:'Composite deviation',components:[{key:'BAD_D',direction:1,threshold:.42,rule:'BAD-D increase >0.42 units'}]}
]);
// Exact decimal arithmetic prevents an equality (e.g. 2.00 → 2.42) from
// crossing a strict threshold because of binary floating-point subtraction.
function decimal(v){const [mantissa,exp='0']=String(v).toLowerCase().split('e'),parts=mantissa.split('.');return {n:BigInt(parts.join('')),places:(parts[1]||'').length-Number(exp)};}
function exactIntegers(values){const d=values.map(decimal),places=Math.max(0,...d.map(x=>x.places));return d.map(x=>x.n*10n**BigInt(places-x.places));}
function crossed(first,latest,rule){const [a,b,t]=exactIntegers([first,latest,rule.threshold]);return rule.percent?100n*(a-b)>BigInt(rule.threshold)*a:(b-a)*BigInt(rule.direction)>t;}
const clean=v=>Number(v.toFixed(12));
const fmt=(v,d)=>Number(v).toFixed(Math.max(d,Math.min(10,decimal(v).places)));
const signed=(v,d)=>(v>0?'+':v<0?'−':'')+fmt(Math.abs(v),d);

function summarize(current,result,sourceDirty=false,projectionConfig=null){
  const out={eye:current.eye,kind:'waiting',title:'Awaiting calculation',reason:'Verify the visit measurements and calculate NKPI above.',rows:[],domains:[],crossed:null,demo:false};
  if(!current.enabled)return {...out,kind:'excluded',title:'Eye not included',reason:'Enable this eye above to include its measurements.'};
  if(sourceDirty)return {...out,kind:'review',title:'Source changed',reason:'Verify and reimport the selected source before reviewing change.'};
  if(!result)return out;
  if(result.eye!==current.eye||S.stable(S.canonical(current))!==S.stable(result.case))return {...out,kind:'review',title:'Recalculation needed',reason:'The measurements changed. Verify and calculate again.'};
  const c=result.case;
  out.demo=c.demo===true;
  if(c.verified!==true||!['ready','held'].includes(result.status)||(result.errors||[]).length)return {...out,kind:'review',title:'Comparison needs review',reason:(result.errors||[]).concat(result.holds||[]).join(' ')||'Confirm comparable source measurements before reviewing change.'};
  if(result.status==='held'&&!(c.treatment==='treated'&&(result.holds||[]).length>0&&(result.holds||[]).every(h=>h==='Prior CXL is outside this model’s intended use.')))return {...out,kind:'review',title:'Comparison needs review',reason:(result.holds||[]).join(' ')||'Resolve the held assessment before reviewing change.'};
  if(c.mode!=='longitudinal')return {...out,kind:'single',title:'A second visit is needed',reason:'One visit describes the eye, but cannot show change between visits.'};
  if(!Number.isInteger(c.interval_days)||c.interval_days<1||!c.first||!c.latest)return {...out,kind:'review',title:'Comparison incomplete',reason:'Two verified visits and their interval are required.'};
  if(['first','latest'].some(v=>c.scan_quality?.[v]==='warning'))return {...out,kind:'review',title:'Scan quality needs review',reason:'A scan has a recorded quality or alignment warning. Domain assessment is withheld until comparable quality measurements are available.'};
  // Missing/invalid components never become a negative vote or a stable result.
  for(const f of S.features){
    const first=c.first[f.key],latest=c.latest[f.key];
    if(!Number.isFinite(first)||!Number.isFinite(latest)||first<f.low||first>f.high||latest<f.low||latest>f.high)return {...out,rows:[],kind:'review',title:'Comparison incomplete',reason:'All six reliable measurements are required at both visits. Missing values are not treated as unchanged.'};
    out.rows.push({...f,first,latest,change:clean(latest-first)});
  }
  out.domains=RULES.map(domain=>{
    const components=domain.components.map(rule=>{const row=out.rows.find(r=>r.key===rule.key);return {...row,...rule,crossed:crossed(row.first,row.latest,rule),percentDecrease:rule.percent?100*(row.first-row.latest)/row.first:null};});
    return {key:domain.key,name:domain.name,components,crossed:components.some(r=>r.crossed)};
  });
  out.crossed=out.domains.filter(d=>d.crossed).length;
  out.structuralCrossed=out.domains.slice(0,3).filter(d=>d.crossed).length;
  out.criterionMet=out.crossed>=2;
  out.kind='thresholds';
  out.title=out.criterionMet?'Multiple domains cross thresholds':out.crossed===1?'One domain crosses its threshold':'No domain thresholds crossed';
  out.reason=out.criterionMet?'The numerical SOURCE criterion (at least 2 of 4 domains) is met. Review comparison eligibility below.':'The numerical SOURCE criterion (at least 2 of 4 domains) is not met. This does not establish stability.';
  out.intervalDays=c.interval_days;
  out.scope=[];
  if(!Number.isFinite(c.age)||c.age<18||c.age>50)out.scope.push('Baseline age is outside the SOURCE study range of 18–50 years.');
  // Six calendar months span 181–184 days. The calculator retains interval
  // days, not examination dates. Do not substitute a false 180/183-day rule.
  if(c.interval_days<181)out.scope.push('The '+c.interval_days+'-day interval is shorter than the SOURCE minimum of six months.');
  else if(c.interval_days<184)out.scope.push('Check the examination dates: '+c.interval_days+' days alone cannot establish six calendar months.');
  if(!['first','latest'].every(v=>c.scan_quality?.[v]==='ok'))out.scope.push('Acceptable scan quality has not been established for both visits.');
  if(c.treatment==='treated')out.scope.push('Prior or interval corneal treatment is recorded; this comparison is outside the pretreatment SOURCE protocol.');
  else if(c.treatment!=='untreated')out.scope.push('The absence of CXL or other corneal procedures before and between these visits has not been established.');
  out.scopeTitle=out.scope.length?'SOURCE classification not assigned':'Recorded comparison requirements met';
  out.scopeNote=out.scope.length?'Threshold crossings are shown, but the study classification cannot be assigned from this comparison.':'Age, interval, quality and recorded treatment status fit the comparison requirements. Full study eligibility and clinical progression still require review.';
  out.conflicts=[];
  const a=out.rows.find(r=>r.key==='A'),k=out.rows.find(r=>r.key==='Kmax');
  if((a.change<0)!==(k.change>0)&&(a.change<0||k.change>0))out.conflicts.push('ARC and Kmax do not show the same worsening direction. Anterior curvature can cross its threshold through either measurement; this disagreement remains relevant.');
  if(projectionConfig){
    try{
      S.verifyProjection(result,projectionConfig);
      const p=result.projection;
      if(p.status==='ready'){
        if(p.observed_count!==out.crossed)throw new Error('Observed count differs');
        for(const scenario of p.scenarios){
          for(const domain of RULES){
            const expected=domain.components.some(rule=>crossed(c.latest[rule.key],scenario.projected_values[rule.key],rule));
            if(expected!==scenario.domain_flags[domain.key])throw new Error('Projected value/threshold mismatch');
          }
        }
      }
      out.projection=p;
    }catch(_){out.projection={status:'unavailable',reason:'Projection verification failed. Recalculate this eye.'};}
  }
  return out;
}

function changeLabel(r){return signed(r.change,r.key==='A'||r.key==='B'?3:r.decimals)+' '+(r.unit||'units')+(r.percent?' ('+Math.abs(r.percentDecrease).toFixed(2)+'% '+(r.percentDecrease>0?'thinner':r.percentDecrease<0?'thicker':'change')+')':'');}
// The fitted random-slope distribution is used for an explicitly conditional
// research projection. Arbitrary forecast/probability properties are ignored.
function forecastPanel(out){
  const p=out.projection;
  if(!p||p.status!=='ready')return '<section class="progression-forecast" data-forecast-status="unavailable"><div class="projection-kicker">NEXT SIX MONTHS · RESEARCH SCENARIO</div><div class="progression-forecast-label">Projection unavailable</div><p>'+E(p?.reason||out.reason||'Calculate both visits above.')+'</p></section>';
  const status=p.threshold_sensitive?'Too uncertain to resolve the two-domain threshold':p.assumption_sensitive?'Sensitive to noise assumptions':'Conditional on the stated noise assumptions';
  const scenarioRows=p.scenarios.map(v=>'<tr><td>'+E(v.name)+'</td><td>'+v.count+'/4</td><td>'+v.range[0]+'–'+v.range[1]+'</td></tr>').join('');
  return '<section class="progression-forecast" data-forecast-status="ready"><div class="projection-kicker">NEXT SIX MONTHS · RESEARCH SCENARIO</div><div class="projection-inline"><div class="progression-forecast-value">'+p.central_count+'<span>/4</span></div><div><div class="progression-forecast-label">Projected domain crossings</div><p>Latest scan → next 183 days</p></div></div><div class="projection-sensitivity">'+E(status)+'</div><p class="projection-qualifier">Central scenario only · not a validated forecast</p>'+
    '<details class="progression-forecast-definition"><summary>Assumptions &amp; uncertainty</summary><div class="projection-range"><span>Range across noise assumptions</span><strong>'+p.range[0]+'–'+p.range[1]+'<small> / 4</small></strong></div>'+
    (p.warnings.length?'<p class="projection-context">'+p.warnings.map(E).join(' ')+'</p>':'')+
    '<p>The eye’s recent change is combined with a joint trend distribution fitted to 179 eligible eyes from 101 patients. Uncertain trends are tempered according to assumed scan noise. The same four thresholds are applied using the latest scan as the new reference; observed crossings are not carried forward. Noise adjustment can give a lower projected count without establishing improvement.</p><table class="projection-scenarios"><thead><tr><th>Noise assumption</th><th>Count</th><th>Range</th></tr></thead><tbody>'+scenarioRows+'</tbody></table><p>The range combines central 90% simulation ranges under four noise assumptions. These settings are sensitivity choices scaled to the thresholds, not measured device repeatability limits or a validated confidence interval.</p><p>This assumes continued change without treatment and comparable scans. It is not a probability, diagnosis or validated forecast. No third visits are available to validate two-visit forecasts. Cohort-parameter uncertainty and future changes in trend are not included. Age does not automatically reduce the projected trend.</p><p>The JSON download retains the full research projection and assumptions. NKPI and its PDF remain separate.</p></details></section>';
}
function render(out){
  const eye=out.eye==='OD'?'OD · Right eye':'OS · Left eye';
  const header='<div class="progression-eye-heading"><h3>'+eye+'</h3>'+(out.demo?'<span class="badge">SYNTHETIC EXAMPLE</span>':'')+'</div>';
  const status='<div class="progression-status">'+E(out.title)+'</div><p class="progression-reason">'+E(out.reason)+'</p>';
  if(!out.domains.length){
    const unavailable=RULES.map(d=>'<div class="progression-domain-unavailable"><span>'+E(d.name)+'</span><span>Unavailable</span></div>').join('');
    return '<article class="progression-eye" data-progression-eye="'+E(out.eye)+'"><div class="progression-overview">'+header+(out.kind==='excluded'?'':forecastPanel(out))+'</div><div class="progression-detail">'+status+(out.kind==='excluded'?'':unavailable)+'</div></article>';
  }
  const domains=out.domains.map(d=>'<details class="progression-domain" data-domain="'+E(d.key)+'" open><summary><span class="progression-domain-name">'+E(d.name)+'</span><span class="progression-domain-status '+(d.crossed?'crossed':'not-crossed')+'">'+(d.crossed?'Threshold crossed':'Not crossed')+'</span></summary>'+d.components.map(r=>'<div class="progression-component"><span>'+E(r.label)+'</span><strong>'+E(changeLabel(r))+'</strong><small>'+E(r.rule)+(d.components.length>1?' · OR rule':'')+'</small><span class="progression-component-result">'+(r.crossed?'Crossed':'Not crossed')+'</span><small class="progression-component-visits">Baseline '+fmt(r.first,r.decimals)+' → latest '+fmt(r.latest,r.decimals)+' '+E(r.unit||'units')+'</small></div>').join('')+'</details>').join('');
  const rows=out.rows.map(r=>'<tr><th scope="row">'+E(r.label)+'<small>'+E(r.unit||'units')+'</small></th><td>'+fmt(r.first,r.decimals)+'</td><td>'+fmt(r.latest,r.decimals)+'</td><td>'+signed(r.change,r.key==='A'||r.key==='B'?3:r.decimals)+'</td></tr>').join('');
  const observation=out.crossed+' of 4 domains crossed '+(out.crossed===1?'its threshold':'their thresholds')+' over '+out.intervalDays+' days. '+(out.criterionMet?'The numerical two-domain criterion is met; comparison eligibility still applies.':'The two-domain criterion is not met. This does not establish stability.');
  const context=out.scope.find(t=>t.includes('treatment is recorded'))||out.scope.find(t=>t.includes('scan quality'))||out.scope.find(t=>t.includes('interval'))||out.scope[0]||'Recorded age, interval, quality and treatment requirements met.';
  return '<article class="progression-eye" data-progression-eye="'+E(out.eye)+'"><div class="progression-overview'+(out.crossed?' has-crossings':'')+'">'+header+
    '<div class="progression-observed-label">Observed threshold crossings</div><div class="progression-count"><b>'+out.crossed+'<span>/4</span></b><span>observed over '+out.intervalDays+' days</span></div><p class="observed-reference">Earlier scan → latest scan</p>'+forecastPanel(out)+'</div><div class="progression-detail"><p class="progression-reason">'+E(observation)+'</p>'+domains+
    '<p class="progression-meta">2 visits · '+out.intervalDays+'-day history · Earlier → latest</p>'+
    '<details class="progression-evidence"><summary><span><b>'+E(out.scopeTitle)+'</b><small>'+E(context)+'</small></span></summary><p>'+E(out.scopeNote)+'</p>'+(out.scope.length?'<ul>'+out.scope.map(t=>'<li>'+E(t)+'</li>').join('')+'</ul>':'')+'</details>'+
    out.conflicts.map(t=>'<p class="progression-caution">'+E(t)+'</p>').join('')+
    '<details class="progression-values"><summary>Measurements, structural check &amp; SOURCE rules</summary><div class="progression-structural"><b>'+out.structuralCrossed+' / 3 structural domains cross thresholds</b><p>Sensitivity check: '+(out.structuralCrossed>=2?'the ≥2-of-3 structural criterion is met.':'the ≥2-of-3 structural criterion is not met.')+' This uses anterior curvature (ARC or Kmax), posterior curvature and pachymetry (thickness or ARTmax). BAD-D is excluded because it overlaps these measurements.</p></div><div class="table-wrap"><table><caption class="sr-only">'+eye+' baseline and latest measurements</caption><thead><tr><th>Measurement</th><th>Baseline</th><th>Latest</th><th>Change</th></tr></thead><tbody>'+rows+'</tbody></table></div><p>Thickness decrease = 100 × (baseline − latest) / baseline. Each domain contributes at most one point. Strict greater-than thresholds are applied to the entered values before display rounding. A value exactly at the threshold does not cross it. Raw radii are used, not ABCD stage scores.</p><p>SOURCE P0175 resubmission, pages 3–4: the research endpoint requires ≥2 of 4 domains in an eligible comparison. The 0–1 domain result means the threshold criterion is not met; missing or unreliable values are indeterminate, not stable.</p><p>Study comparisons require baseline age 18–50, acceptable same-eye pretreatment scans at least six calendar months apart, and all six verified measurements. Prior corneal procedures, scans across treatment, documented scarring >1 mm and other protocol exclusions need source-record review. Scarring, contact-lens washout and full study enrollment eligibility are not assessed here. Missing information is not evidence of absence.</p><p>Prespecified research criteria, not a validated diagnosis, progression probability or CXL recommendation. The thresholds have not been validated here for post-CXL monitoring. Neither age nor interval adds domain points. This panel does not change NKPI or its PDF. The JSON export includes the separately labelled research projection.</p></details></div></article>';
}
const api={summarize,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.NKPIProgression=api;
})(typeof window!=='undefined'?window:globalThis);
