/* BellaNova: one shared UI renderer for sender and coordinator. Simulation only. */
(() => {
'use strict';
const coordinator=document.body.dataset.role==='coordinator';
const $=(s)=>document.querySelector(s);
const esc=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=(v)=>Number(v||0).toLocaleString();
const short=(id)=>String(id||'').slice(0,8).toUpperCase();
const typeName=(r)=>r.helpType||r.type;
const label=(r)=>r.status==='DEMO_DELIVERY_CONFIRMED'?'RESOLVED':r.status==='ASSIGNED'?'APPROVED / HELP ASSIGNED':r.triageConfirmed?'PRIORITY CONFIRMED':'RECEIVED';
const prioSort=(r)=>({P1:0,P2:1,P3:2,P4:3}[r.confirmedPriority]??5);
let state=null,revision=-1,loading=false,view='overview',gps=null;
const views={overview:'Live Overview',requests:'SOS Requests',priority:'Priority Queue',approval:'Assignment & Approval',closure:'ProofLoop Closure',fairshare:'FairShare',silentzone:'SilentZone',stock:'Resource Stock'};
function showMessage(message,error=false){const f=$('#flash');f.textContent=message;f.className='flash'+(error?' error':'');f.hidden=false;clearTimeout(showMessage.timer);showMessage.timer=setTimeout(()=>f.hidden=true,7000);}
function navTo(key){view=key;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('show',v.dataset.view===key));document.querySelectorAll('.nav').forEach(v=>v.classList.toggle('active',v.dataset.go===key));$('#page-title').textContent=views[key]||key;window.location.hash=key;}
async function api(path,method='GET',body){const opt={method,headers:{'Accept':'application/json'}};if(body!==undefined){opt.headers['Content-Type']='application/json';opt.body=JSON.stringify(body);}const r=await fetch(path,opt);let data;try{data=await r.json();}catch{throw new Error('Unexpected server response. Check you opened the correct BellaNova server.');}if(!r.ok||!data.success)throw new Error(data.message||'Unable to complete action');return data;}
async function refresh(force=false){if(loading)return;loading=true;try{const d=await api('/api/live/state');$('#connect-state').textContent='● Connected to shared server';if(force||!state||d.revision!==revision){state=d;revision=d.revision;render();}}catch(e){$('#connect-state').textContent='● Disconnected — retrying';if(force)showMessage(e.message,true);}finally{loading=false;}}
async function act(path,body,msg){try{await api(path,'POST',body);showMessage(msg||'Saved to both laptops.');await refresh(true);}catch(e){showMessage(e.message,true);}}
function render(){if(!state)return;const s=state.stats;
 $('#stats').innerHTML=[['SOS Requests',s.sosRequests,'◉'],['Critical Priority',s.criticalPriority,'⚑'],['Pending Approval',s.pendingApproval,'◷'],['Resolved Cases',s.resolvedCases,'✓']].map(([name,val,icon])=>`<div class="stat"><div class="stat-icon">${icon}</div><div class="stat-label">${name}</div><strong class="stat-value">${number(val)}</strong></div>`).join('');
 if(coordinator){renderPriority();renderApproval();renderClosure();}else renderSender();renderFairshare();renderSilentZone();}
function info(r){return `<div class="case-head"><strong>${esc(r.name)} <span class="case-id">#${short(r.id)}</span></strong><span class="pill ${r.status==='DEMO_DELIVERY_CONFIRMED'?'resolved':(r.confirmedPriority||'').toLowerCase()}">${esc(r.confirmedPriority||label(r))}</span></div><p class="case-details"><b>${esc(typeName(r))}</b> · ${esc(r.area)} · ${esc(r.location)}${r.latitude!==undefined?` · GPS ${Number(r.latitude).toFixed(4)}, ${Number(r.longitude).toFixed(4)}`:''}<br>${r.description?esc(r.description):'<i>No description provided</i>'}</p>`;}
function renderSender(){const list=$('#sos-list');if(!list)return;const rows=[...state.requests].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
 list.innerHTML=rows.length?rows.map(r=>`<div class="case">${info(r)}<span class="pill ${r.status==='DEMO_DELIVERY_CONFIRMED'?'resolved':''}">${esc(label(r))}</span>${r.fairshareAllocation?'<p class="helper">✓ Food / Water resources allocated through FairShare</p>':''}</div>`).join(''):'<div class="empty">No SOS requests yet. Submit the first simulated request.</div>';}
function renderPriority(){const list=$('#priority-list');const rows=[...state.requests].filter(r=>r.status==='OPEN').sort((a,b)=>prioSort(a)-prioSort(b)||String(a.createdAt).localeCompare(String(b.createdAt)));
 list.innerHTML=rows.length?rows.map(r=>`<div class="case">${info(r)}<div class="controls"><label>Human priority<select data-priority-id="${esc(r.id)}">${['P1','P2','P3','P4'].map(p=>`<option value="${p}" ${p===(r.confirmedPriority||'P3')?'selected':''}>${p} — ${{P1:'Critical',P2:'High',P3:'Medium',P4:'Low'}[p]}</option>`).join('')}</select></label><button class="primary" data-action="priority" data-id="${esc(r.id)}">CONFIRM PRIORITY</button></div>${r.triageConfirmed?'<p class="helper">✓ Priority confirmed. This case is in Assignment & Approval.</p>':''}</div>`).join(''):'<div class="empty">No unassigned requests.</div>';}
function renderApproval(){const list=$('#approval-list');const rows=state.requests.filter(r=>r.status==='OPEN' && r.triageConfirmed).sort((a,b)=>prioSort(a)-prioSort(b));
 list.innerHTML=rows.length?rows.map(r=>{
  const resources=state.resources.filter(x=>x.type===r.type && (Number(x.quantity)>0&&x.status==='AVAILABLE'||r.fairshareAllocation?.resourceId===x.id));
  const teams=state.rescueTeams.filter(x=>x.status==='AVAILABLE' && (x.speciality===r.type||x.speciality==='ANY'));
  return `<div class="case">${info(r)}${r.failureInfo?`<p class="helper">PLAN A FAILED. ${r.replanSuggestion?`Suggested backup: ${esc(r.replanSuggestion.resourceName)} + ${esc(r.replanSuggestion.teamName)}. Select these for Plan B and click YES ? APPROVE.`:"No backup available; keep this request pending."}</p>`:""}${r.fairshareAllocation?'<p class="helper">FairShare allocation already reserved for this request.</p>':''}<div class="controls"><label>Resource / Help Assigned<select data-resource-id="${esc(r.id)}">${resources.length?resources.map(x=>`<option value="${esc(x.id)}">${esc(x.name)} (${x.quantity} available)</option>`).join(''):'<option value="">No available compatible resource</option>'}</select></label><label>Trained Rescue Team<select data-team-id="${esc(r.id)}">${teams.length?teams.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join(''):'<option value="">No available trained team</option>'}</select></label><button class="primary" data-action="approve" data-id="${esc(r.id)}" ${!resources.length||!teams.length?'disabled':''}>YES — APPROVE</button><button class="danger" data-action="reject" data-id="${esc(r.id)}">NO — REJECT</button></div></div>`;}).join(''):'<div class="empty">No requests awaiting human approval. Confirm priority first.</div>';}
function renderClosure(){const pending=state.requests.filter(r=>r.status==='ASSIGNED');const resolved=state.requests.filter(r=>r.status==='DEMO_DELIVERY_CONFIRMED');
 $('#closure-list').innerHTML=pending.length?pending.map(r=>`<div class="case">${info(r)}<p>Has the affected person received the assigned help?</p><div class="controls"><button class="primary" data-action="resolve" data-id="${esc(r.id)}">YES — RESOLVED</button><button class="secondary" data-action="notyet" data-id="${esc(r.id)}">NO — NOT YET</button><button class="danger" data-action="replan" data-id="${esc(r.id)}">SIMULATE PLAN FAILURE ? REPLAN</button></div></div>`).join(''):'<div class="empty">No approved cases awaiting a completion decision.</div>';
 $('#resolved-list').innerHTML=resolved.length?resolved.map(r=>`<div class="case">${info(r)}<span class="pill resolved">✓ RESOLVED ${r.resolvedAt?new Date(r.resolvedAt).toLocaleString():''}</span></div>`).join(''):'<div class="empty">No resolved cases yet.</div>';}
function fairshareImpact(p){
 const villages=Array.isArray(p.byVillage)?p.byVillage:[];
 if(!villages.length)return '<div style="margin:12px 0;padding:12px;border:1px solid #31506a;border-radius:10px;background:#11263b;color:#bdd1e4"><b>Impact Predictor ? Before Approval</b><p class="helper">No pending Food / Water requests. New requests will generate a live comparison.</p></div>';
 const demand=villages.reduce((n,v)=>n+Number(v.demand||0),0);
 const served=Math.min(demand,Math.max(0,Number(p.allocated||0)));
 const reached=villages.filter(v=>Number(v.supplied||0)>0);
 const left=villages.filter(v=>Number(v.demand||0)>0&&Number(v.supplied||0)===0);
 const pct=demand?Math.round(100*served/demand):0;
 const detail=left.length?'Without allocated supply: '+left.map(v=>esc(v.location)).join(', '):'Every requesting village receives some supply.';
 return '<div style="margin:13px 0;padding:14px;border:1px solid #357c77;border-radius:10px;background:#102f37">'+
 '<strong style="color:#7ce7d7">Impact Predictor ? Before Approval</strong>'+
 '<p style="color:#dcecf9;margin:8px 0">'+served+' / '+demand+' pending SOS requests covered ? '+reached.length+' / '+villages.length+' villages reached</p>'+
 '<div style="height:9px;background:#31465d;border-radius:20px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:#34d4c4"></div></div>'+
 '<p style="color:#ccdce8;margin:9px 0 4px">'+(demand-served)+' requests still waiting ? '+left.length+' villages receive zero units</p>'+
 '<p class="helper">'+detail+'</p>'+
 '<p class="helper">Simulated allocation forecast, not confirmed delivery.</p></div>';
}
function renderFairshare(){const f=state.fairshare,el=$('#fairshare-content');if(!el)return;
 const example="\n<section id=\"fairshare-simple-example\" class=\"panel\" style=\"margin-bottom:18px\">\n<h2>Why FairShare Matters</h2>\n<p>Example: 30 households need help, but only 18 supply units exist.</p>\n\n<div class=\"fairgrid\">\n<div class=\"mini\"><small>Households</small><strong>30</strong></div>\n<div class=\"mini\"><small>Registrations</small><strong>31</strong></div>\n<div class=\"mini\"><small>Available Units</small><strong>18</strong></div>\n<div class=\"mini\"><small>Supply Coverage</small><strong>60%</strong></div>\n</div>\n\n<div class=\"two\" style=\"margin-top:16px\">\n<div class=\"option\">\n<h3>Fastest-first</h3>\n<p>Closest villages receive supplies first.</p>\n<div class=\"village\"><span>Riverbank Village</span><b>10</b></div>\n<div class=\"village\"><span>Hillview Village</span><b>8</b></div>\n<div class=\"village\"><span>Meadow Hamlet</span><b>0</b></div>\n<div class=\"village\"><span>Pine Ridge</span><b>0</b></div>\n<p><b>18 helped / 12 waiting</b></p>\n<p>Two villages receive nothing.</p>\n</div>\n\n<div class=\"option\">\n<h3>Fair Rotation</h3>\n<p>Spread supplies across more villages.</p>\n<div class=\"village\"><span>Riverbank Village</span><b>5</b></div>\n<div class=\"village\"><span>Hillview Village</span><b>5</b></div>\n<div class=\"village\"><span>Meadow Hamlet</span><b>4</b></div>\n<div class=\"village\"><span>Pine Ridge</span><b>4</b></div>\n<p><b>18 helped / 12 waiting</b></p>\n<p>All four villages receive help.</p>\n</div>\n</div>\n\n<p class=\"helper\">Illustrative example, not live stock.\nActual allocation and coordinator approval appear below.</p>\n</section>\n<h3>Live FairShare ? Synced on Both Screens</h3>";
 const tiles=[['Food / Water Available / Total',`${f.stock} / ${f.totalSupply}`],['Total Demand',f.demand],['Allocated',f.allocated],['Shortage',f.shortage]].map(([name,val])=>`<div class="mini"><small>${name}</small><strong>${typeof val === "string" ? esc(val) : number(val)}</strong></div>`).join('');
 const approved=f.lastApproved?`<div class="approved-bar"><strong>✓ Last approved: ${f.lastApproved.mode==='fair'?'Fairness-Aware':'Speed-First'}</strong> · ${f.lastApproved.allocations.length} allocations · ${new Date(f.lastApproved.at).toLocaleString()}<p class="helper">Saved centrally; visible on BOTH laptops. Allocation does not mark an SOS resolved.</p></div>`:'<p class="helper">No FairShare plan has been approved yet. Both laptops show the same live comparison.</p>';
 const rows=f.villageDistribution.length?f.villageDistribution.map(x=>`<div class="village"><span>${esc(x.area)}</span><span>${x.demand} need</span><span>${x.allocated} allocated</span></div>`).join(''):'<p class="muted">Village distribution appears after Food / Water requests are received.</p>';
 const option=(mode,title,description)=>{const p=f.previews[mode];return `<div class="option"><h3>${title}</h3><p>${description}</p>${fairshareImpact(p)}<strong>${number(p.allocated)} planned allocations</strong><p>${p.byVillage.length?`Coverage floor: ${p.minVillageCoveragePercent}%`:'No pending food/water demand'}</p>${p.byVillage.length?p.byVillage.map(v=>`<div class="village"><span>${esc(v.location)}</span><span>${v.demand} need</span><span>${v.supplied} planned</span></div>`).join(''):''}${coordinator?`<button class="${mode==='fair'?'primary':'secondary'}" data-action="fairshare" data-mode="${mode}" ${p.allocations.length?'':'disabled'}>APPROVE ${title.toUpperCase()}</button>`:''}</div>`;};
 el.innerHTML=example+`<div class="fairgrid">${tiles}</div>${approved}<div class="two">${option('speed','Speed-First','Prioritizes urgent requests, then nearby allocations using the original simulation model.')}${option('fair','Fairness-Aware','Protects urgent requests while improving coverage for underserved villages.')}</div><div class="panel" style="margin-top:17px"><h3>Live village-wise distribution</h3><div class="village"><strong>Village</strong><strong>Demand</strong><strong>Allocated</strong></div>${rows}<p class="helper">${esc(f.fairnessNote)} No extra dashboard KPI boxes.</p></div>`;}
function renderSilentZone(){const el=$('#silentzone-content'),teams=state.rescueTeams.filter(x=>x.status==='AVAILABLE');
 const form=coordinator?`<div class="panel" style="margin-bottom:17px"><h3>Assign a fictional field check</h3><div class="controls"><label>Silent area / village<input id="silent-area" maxlength="120" placeholder="Disconnected village"></label><label>Trained field team<select id="silent-team">${teams.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label><button class="primary" data-action="silentassign" ${teams.length?'':'disabled'}>ASSIGN FIELD TEAM</button></div></div>`:'';
 const cards=state.silentZones.length?state.silentZones.map(z=>`<div class="case"><div class="case-head"><strong>${esc(z.area)}</strong><span class="pill ${z.status==='FIELD_CHECK_COMPLETED'?'resolved':''}">${z.status==='FIELD_CHECK_COMPLETED'?'CHECK COMPLETED':'FIELD CHECK ASSIGNED'}</span></div><p class="case-details">Trained team: ${esc(state.rescueTeams.find(t=>t.id===z.teamId)?.name||z.teamId)}<br>Communication status: Not confirmed</p>${coordinator&&z.status!=='FIELD_CHECK_COMPLETED'?`<div class="controls"><label>Field report (optional)<input maxlength="400" data-silent-note="${esc(z.id)}" placeholder="Fictional check outcome"></label><button class="primary" data-action="silentcomplete" data-id="${esc(z.id)}">CONFIRM CHECK COMPLETED</button></div>`:z.fieldReport?`<p class="helper">Report: ${esc(z.fieldReport)}</p>`:''}</div>`).join(''):'<div class="empty">No disconnected-area field checks assigned yet.</div>';
 el.innerHTML=`${form}<div class="panel"><h3>SilentZone field missions</h3><p class="muted">Real offline villages cannot transmit over a nonexistent network. This simulates a physical welfare check.</p><div class="cards">${cards}</div></div>`;}
async function onClick(ev){const btn=ev.target.closest('[data-action]');if(!btn||!state)return;const id=btn.dataset.id;const action=btn.dataset.action;
 const selector=(attr)=>document.querySelector(`[${attr}="${CSS.escape(id)}"]`);
 btn.disabled=true;
 try{
  if(action==='priority') await act(`/api/live/priority/${encodeURIComponent(id)}`,{priority:selector('data-priority-id').value},'Priority confirmed.');
  if(action==='approve') await act(`/api/live/approval/${encodeURIComponent(id)}`,{approved:true,resourceId:selector('data-resource-id').value,teamId:selector('data-team-id').value},'Help assignment approved.');
  if(action==='reject') await act(`/api/live/approval/${encodeURIComponent(id)}`,{approved:false},'Assignment rejected; case remains open.');
  if(action==='replan') await act(`/api/live/replan/${encodeURIComponent(id)}`,{},'Plan A failed. Check Assignment & Approval for Plan B.');
  if(action==='resolve') await act(`/api/live/closure/${encodeURIComponent(id)}`,{received:true},'Case RESOLVED. Both dashboards updated.');
  if(action==='notyet') await act(`/api/live/closure/${encodeURIComponent(id)}`,{received:false},'Case remains unresolved.');
  if(action==='fairshare') await act('/api/live/fairshare/approve',{mode:btn.dataset.mode},'FairShare allocation approved and synchronized.');
  if(action==='silentassign') await act('/api/live/silentzone',{area:$('#silent-area').value,teamId:$('#silent-team').value},'Field check assigned.');
  if(action==='silentcomplete') await act(`/api/live/silentzone/${encodeURIComponent(id)}`,{complete:true,report:selector('data-silent-note').value},'Field check completed.');
 }finally{btn.disabled=false;}
}
function init(){document.querySelectorAll('[data-go]').forEach(btn=>btn.addEventListener('click',()=>navTo(btn.dataset.go)));
 const start=window.location.hash.slice(1);if(views[start]&&document.querySelector(`[data-view="${start}"]`))navTo(start);
 document.addEventListener('click',onClick);
 const form=$('#sos-form');if(form)form.addEventListener('submit',async ev=>{
  ev.preventDefault();const btn=$('#submit-sos');btn.disabled=true;
  const data={name:$('#person').value,area:$('#area').value,location:$('#place').value,helpType:$('#help').value,description:$('#description').value,
   clientSubmissionId:`sos-${Date.now()}-${Math.random().toString(36).slice(2,14)}`};if(gps){data.latitude=gps.latitude;data.longitude=gps.longitude;}
  try{const out=await api('/api/live/sos','POST',data);form.reset();gps=null;$('#gps-hint').textContent='GPS may require HTTPS; manual location always works.';showMessage(`SOS #${short(out.requestId)} received by shared server.`);await refresh(true);}catch(e){showMessage(e.message,true);}finally{btn.disabled=false;}
 });
 const gpsBtn=$('#gps-btn');if(gpsBtn)gpsBtn.addEventListener('click',()=>{
   const hint=$('#gps-hint');if(!navigator.geolocation){hint.textContent='GPS unavailable. Enter the location manually.';return;}
   hint.textContent='Requesting GPS permission…';navigator.geolocation.getCurrentPosition(pos=>{
    gps={latitude:pos.coords.latitude,longitude:pos.coords.longitude};$('#place').value=`GPS: ${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`;hint.textContent='GPS coordinates captured.';
   },()=>{gps=null;hint.textContent='GPS unavailable on this connection. Enter location manually.';},{enableHighAccuracy:true,timeout:10000,maximumAge:15000});
 });
 refresh(true);
 try { const events=new EventSource('/api/live/events');events.addEventListener('changed',()=>refresh());events.onerror=()=>{$('#connect-state').textContent='● Reconnecting…';};}catch{}
 setInterval(()=>refresh(),3500);
}
init();
})();


