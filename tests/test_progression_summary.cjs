 'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),S=require('../components/schema.js'),P=require('../components/progression_summary.js');
const make=(eye='OD')=>({...S.blank(eye),enabled:true,mode:'longitudinal',age:22,verified:true,interval_days:365,treatment:'untreated',scan_quality:{first:'ok',latest:'ok'},first:{A:7.57,B:6.16,C:500,Kmax:45,BAD_D:2,ARTmax:200},latest:{A:7.57,B:6.16,C:500,Kmax:45,BAD_D:2,ARTmax:200}});
const result=c=>({eye:c.eye,case:S.canonical(c),status:'ready',prediction:{nkpi:63},errors:[],holds:[]});
const summarize=c=>P.summarize(c,result(c));
let c=make(),r=result(c),summary=summarize(c);
assert.equal(summary.crossed,0);assert.equal(summary.domains.length,4);assert.equal(summary.criterionMet,false);assert.equal(summary.scope.length,0);
assert(P.render(summary).includes('does not establish stability'));
// Observed rows stay exact; research projection requires an audited server result.
let compact=P.render(summary);
assert.equal((compact.match(/<details class="progression-domain"/g)||[]).length,4);
assert.equal((compact.match(/<details class="progression-domain"[^>]*\bopen\b/g)||[]).length,4);
assert(compact.indexOf('Observed threshold crossings')<compact.indexOf('Projection unavailable'));
assert(compact.includes('365-day history'));
assert(compact.includes('data-forecast-status="unavailable"'));
assert(!compact.includes('probability of'));
assert(!compact.includes('Measurement outlook'));
assert(!compact.includes('<svg'));
const injected={...summary,forecast:{status:'ready',probability:.68},prediction:{nkpi:72}};
assert.equal(P.render(injected),compact,'Untrusted forecast properties must not become a probability');
const missingSummary=P.summarize(make(),null);
assert.equal((P.render(missingSummary).match(/<span>Unavailable<\/span>/g)||[]).length,4);
assert(!P.render(missingSummary).includes('progression-count'));
// Each of the six exact boundaries, immediately below and above. No UI rounding.
const boundaries=[
 ['A',7.464,7.465,7.463,'anterior'],['B',6.075,6.076,6.074,'posterior'],
 ['C',490,490.001,489.999,'pachymetric'],['Kmax',46,45.999,46.001,'anterior'],
 ['BAD_D',2.42,2.419,2.421,'composite'],['ARTmax',155.76,155.761,155.759,'pachymetric']
];
for(const [key,at,below,above,domain] of boundaries){
 for(const [value,expected] of [[at,0],[below,0],[above,1]]){
  const input=make();input.latest[key]=value;const s=summarize(input);
  assert.equal(s.crossed,expected,key+' strict boundary '+value);
  assert.equal(s.domains.find(d=>d.key===domain).crossed,!!expected);
 }
}
// Opposite change directions never cross. Six crossed variables remain 4 domains.
c.latest={A:8,B:7,C:520,Kmax:40,BAD_D:1,ARTmax:300};assert.equal(summarize(c).crossed,0);
c.latest={A:7.4,B:6,C:480,Kmax:47,BAD_D:3,ARTmax:150};summary=summarize(c);
assert.equal(summary.crossed,4);assert.equal(summary.structuralCrossed,3);
c=make();c.latest={...c.first,A:7.4,Kmax:47};assert.equal(summarize(c).crossed,1);
c=make();c.latest={...c.first,C:480,ARTmax:150};assert.equal(summarize(c).crossed,1);
c=make();c.latest={...c.first,Kmax:47,BAD_D:3};summary=summarize(c);
assert.equal(summary.crossed,2);assert.equal(summary.structuralCrossed,1);assert.equal(summary.criterionMet,true);
assert(P.render(summary).includes('≥2-of-3 structural criterion is not met'));
// User's observed deltas, with BAD-D/ARTmax held constant in this synthetic fixture.
c=make('OS');c.interval_days=80;c.first.C=437;c.latest={...c.first,A:7.64,B:6.29,C:425,Kmax:46.9};summary=summarize(c);
assert.equal(summary.crossed,2);assert.equal(summary.structuralCrossed,2);assert.equal(summary.conflicts.length,1);
assert(Math.abs(summary.domains[2].components[0].percentDecrease-2.74599542334)<1e-9);
assert(summary.scope.some(x=>x.includes('80-day')));assert.equal(summary.scopeTitle,'SOURCE classification not assigned');
assert(P.render(summary).includes('2.75% thinner'));assert(P.render(summary).includes('SOURCE classification not assigned'));
// A missing composite component cannot silently become a zero vote.
const incomplete={...c,latest:{...c.latest,BAD_D:null}};assert.equal(summarize(incomplete).kind,'review');assert.equal(summarize(incomplete).crossed,null);
// Older age, longer interval and higher NKPI never add domain points.
for(const [age,days] of [[18,1],[50,184],[90,3650]]){
 const other={...c,age,interval_days:days};const s=summarize(other);assert.equal(s.crossed,2);
 const res=result(other);res.prediction.nkpi=0;assert.equal(P.summarize(other,res).crossed,2);
 res.prediction.nkpi=100;assert.equal(P.summarize(other,res).crossed,2);
}
for(const [days,scope] of [[180,'shorter'],[181,'Check'],[182,'Check'],[183,'Check'],[184,null]]){
 const input={...make(),interval_days:days},s=summarize(input);
 assert.equal(s.scope.length,scope?1:0);if(scope)assert(s.scope[0].includes(scope));
}
for(const age of [18,50])assert.equal(summarize({...make(),age}).scope.length,0);
assert(summarize({...make(),age:50.01}).scope.some(x=>x.includes('age')));
let unknown={...c,treatment:'unknown',scan_quality:{first:'unknown',latest:'unknown'}};
summary=summarize(unknown);assert.equal(summary.crossed,2);assert.equal(summary.scope.length,3);
const treated={...c,treatment:'treated'},heldTreatment={...result(treated),status:'held',prediction:null,holds:['Prior CXL is outside this model’s intended use.']};
summary=P.summarize(treated,heldTreatment);assert.equal(summary.crossed,2);assert(summary.scope.some(x=>x.includes('pretreatment')));
assert(P.render(summary).includes('not been validated here for post-CXL monitoring'));
const warning={...c,scan_quality:{first:'warning',latest:'ok'}};assert.equal(summarize(warning).kind,'review');
// Data safety: held/source/stale/single-eye/invalid cases never retain a count.
r=result(c);
for(const [input,res,dirty,kind] of [
 [{...c,enabled:false},r,false,'excluded'],[c,null,false,'waiting'],[c,r,true,'review'],
 [{...c,verified:false},r,false,'review'],[{...c,eye:'OD'},r,false,'review'],
 [c,{...r,status:'held',prediction:null,holds:['Source verification needed.']},false,'review'],
 [{...c,mode:'baseline'},result({...c,mode:'baseline'}),false,'single'],
 [{...c,interval_days:0},result({...c,interval_days:0}),false,'review'],
 [{...c,first:{...c.first,B:null}},result({...c,first:{...c.first,B:null}}),false,'review'],
 [c,{...r,errors:['Invalid source']},false,'review']
]){const actual=P.summarize(input,res,dirty);assert.equal(actual.kind,kind);assert.equal(actual.domains.length,0);assert(!P.render(actual).includes('progression-count'));}
for(const bad of [NaN,Infinity,-1,2001,null]){const invalid={...c,latest:{...c.latest,ARTmax:bad}};assert.equal(summarize(invalid).kind,'review');}
const held={...r,status:'held',prediction:null,holds:['<img src=x onerror=alert(1)>']};assert(!P.render(P.summarize(c,held)).includes('<img'));
// Baseline-relative thinning, never divided by latest thickness.
const pct=make();pct.first.C=400;pct.latest.C=392;assert.equal(summarize(pct).crossed,0);
pct.latest.C=391.99;assert.equal(summarize(pct).crossed,1);

// Exercise the actual parent app's handlers with the real Python service.
const html=fs.readFileSync(path.join(root,'components/index.html'),'utf8');
assert(!/<details[^>]*id="progression-drawer"[^>]*\bopen\b/.test(html));
assert(html.indexOf('id="progression-drawer"')>html.indexOf('id="results-area"'));
assert.equal((html.match(/id="progression-drawer"/g)||[]).length,1);
for(const old of ['cornea-frame','surface-panel','surface-tab','report-tab','report-panel','trajectory/index.html','report_gallery.js','Longitudinal projections'])assert(!html.includes(old),'Retired workspace must not load: '+old);
assert(html.includes('Progression summary · Both eyes'));
assert(html.includes('Measured change first · six-month research scenario below.'));
assert.equal((html.match(/<iframe /g)||[]).length,1,'Only the Pentacam importer iframe remains');
assert(html.indexOf('id="progression-drawer"')<html.indexOf('<footer>'));
assert(html.indexOf('progression_summary.js')<html.indexOf('app.js?v='));
const ids={},events={},posted=[];
class Element{
 constructor(id){this.id=id;this.handlers={};this.innerHTML='';this.textContent='';this.hidden=false;this.open=false;this.disabled=false;this.style={};this.dataset={};this.contentWindow={postMessage(){}};}
 addEventListener(k,f){(this.handlers[k]??=[]).push(f);}
 fire(k,event={}){for(const f of this.handlers[k]||[])f({target:this,currentTarget:this,...event});}
 getBoundingClientRect(){return {height:ids['progression-drawer']?.open?1600:900};}
 scrollIntoView(){} focus(){} setAttribute(k,v){this[k]=v;}
}
for(const m of html.matchAll(/\bid="([^"]+)"/g))ids[m[1]]=new Element(m[1]);
const parent={postMessage:(data)=>posted.push(data)},win={parent,location:{origin:'https://local.example'},NKPI:S,NKPIProgression:P,NKPIScoreBand:require('../components/score_band.js'),NKPIImpact:{render:()=>''},addEventListener:(k,f)=>events[k]=f};
const context={window:win,document:{getElementById:id=>{assert(ids[id],id);return ids[id];}},crypto:{randomUUID:()=> 'test-session'},structuredClone,ResizeObserver:class{observe(){}},requestAnimationFrame:f=>f(),setTimeout:()=>1,clearTimeout(){},console};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'components/app.js'),'utf8'),context);
const service=payload=>JSON.parse(execFileSync('python3',['-c',"import sys,json; from nkpi.service import calculate,configuration; p=json.load(sys.stdin); print(json.dumps({'config':configuration(),'result':calculate(p,include_pdf=False) if p else None}))"],{cwd:root,input:JSON.stringify(payload),encoding:'utf8'}));

const both=service({eyes:[{...make('OD'),first:{A:7.2,B:5.9,C:500,Kmax:49,BAD_D:3,ARTmax:250},latest:{A:7.13,B:5.85,C:496,Kmax:49.6,BAD_D:3.43,ARTmax:240},interval_days:54}]});
const audited=both.result.eyes.OD,active={...S.blank('OD'),...audited.case,enabled:true};
const good=P.summarize(active,audited,false,both.config.projection);
assert.equal(good.projection.status,'ready');
const display=P.render(good);
assert(display.indexOf('Observed threshold crossings')<display.indexOf('NEXT SIX MONTHS'));
assert(display.indexOf('Assumptions &amp; uncertainty')<display.indexOf('Range across noise assumptions'));
assert(display.includes('Too uncertain to resolve the two-domain threshold'));
assert(!/progression-forecast-definition[^>]* open/.test(display));
assert.equal(good.projection.observed_count,good.crossed);
assert(P.render(good).includes('183 days'));
for(const edit of [p=>p.eye='OS',p=>p.input_sha256='bad',p=>p.model_sha256='bad',p=>p.central_count=99,p=>p.reference='first',p=>p.range=[4,0],p=>p.scenarios[0].domain_flags.anterior='yes']){
 const tampered=structuredClone(audited);edit(tampered.projection);
 assert.throws(()=>S.verify(active,tampered,both.config));
 assert.equal(P.summarize(active,tampered,false,both.config.projection).projection.status,'unavailable');
}
const changed=structuredClone(audited);changed.projection.scenarios[0].projected_values.B=12;
assert.equal(P.summarize(active,changed,false,both.config.projection).projection.status,'unavailable','Projected source values must match flags');
assert.equal(P.summarize(active,audited,true,both.config.projection).projection,undefined);

const setup=service(null);events.message({source:parent,data:{type:'streamlit:render',args:{config:setup.config}}});
assert(ids['progression-columns'].innerHTML.includes('Awaiting calculation'));
// Old extractor map broadcasts are safely ignored without a gallery or iframe.
const beforeMaps=ids['progression-columns'].innerHTML;
events.message({source:ids['extractor-frame'].contentWindow,origin:'https://local.example',data:{type:'nkpi:extractor:maps',session:'test-session',maps:[]}});
assert.equal(ids['progression-columns'].innerHTML,beforeMaps);
events.message({source:{},origin:'https://local.example',data:{type:'nkpi:trajectory:ready'}});
assert.equal(ids['progression-columns'].innerHTML,beforeMaps);
ids['load-example'].fire('click');
const request=posted.findLast(x=>x.value?.action==='assess').value;
const real=service(request.payload);
events.message({source:parent,data:{type:'streamlit:render',args:{config:real.config,response:{id:request.id,result:real.result}}}});
assert(ids['result-columns'].innerHTML.includes('result-model-notes'));
assert(!ids['result-columns'].innerHTML.includes('Clinical interpretation'));
assert.equal((ids['result-columns'].innerHTML.match(/data-score-band=/g)||[]).length,2);
assert(html.indexOf('score_band.js')<html.indexOf('app.js?v='));
assert(!ids['result-columns'].innerHTML.includes('notice warning'));
assert(!/result-model-notes[^>]* open/.test(ids['result-columns'].innerHTML));
assert(ids['progression-columns'].innerHTML.includes('A second visit is needed'));
assert(ids['progression-columns'].innerHTML.includes('−0.150 mm'));
assert(ids['progression-columns'].innerHTML.includes('SYNTHETIC EXAMPLE'));
assert.equal((ids['progression-columns'].innerHTML.match(/data-forecast-status="ready"/g)||[]).length,1);
assert(ids['progression-columns'].innerHTML.includes('Projected domain crossings'));
assert(ids['progression-columns'].innerHTML.includes('Range across noise assumptions'));
ids['progression-drawer'].open=true;ids['progression-drawer'].fire('toggle');
assert.equal(posted.findLast(x=>x.type==='streamlit:setFrameHeight').height,1610);
const checks={checked:true};const wrap={dataset:{editor:'OS'},querySelector:()=>checks};
ids['eye-inputs'].fire('input',{target:{dataset:{field:'latest-B'},value:'5.20',type:'number',closest:()=>wrap}});
assert(!ids['progression-columns'].innerHTML.includes('−0.150 mm'),'An edit clears the old comparison');
assert(ids['progression-columns'].innerHTML.includes('Awaiting calculation'));
events.message({source:parent,data:{type:'streamlit:render',args:{response:{id:request.id,result:real.result}}}});
assert(!ids['progression-columns'].innerHTML.includes('−0.150 mm'),'Stale server result cannot restore comparison');
events.message({source:ids['extractor-frame'].contentWindow,origin:'https://local.example',data:{type:'nkpi:extractor:dirty'}});
assert(ids['progression-columns'].innerHTML.includes('Source changed'));
ids['confirm-reset'].fire('click');assert(!ids['progression-drawer'].open);assert(!ids['progression-columns'].innerHTML.includes('SYNTHETIC EXAMPLE'));
assert(ids['progression-columns'].innerHTML.includes('Eye not included'));
assert(!ids['result-columns'].innerHTML.includes('data-score-band='));
assert(!fs.readFileSync(path.join(root,'components/app.js'),'utf8').includes('nkpi:trajectory:'));
console.log('PASS: bilateral forecast cards, expanded domain details, conditional projections, SOURCE strict threshold boundaries, structural sensitivity, study scope, Python integration, stale/edit/source/reset handling and unchanged NKPI.');
