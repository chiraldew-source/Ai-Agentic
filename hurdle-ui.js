// LifeCrisis AI Surprise Hurdle front-end, using REAL local API responses.
"use strict";
const hurdleState={comparison:null,duplicates:null,claims:null,priority:null};
const hget=(url)=>callApi(url);
const hpost=(url,body)=>post(url,body);
function hText(tag,text,css){return elt(tag,css||"",String(text));}
function hButton(label,handler,cls="secondary-btn"){
  const b=hText("button",label,cls);b.type="button";
  b.addEventListener("click",async()=>{b.disabled=true;try{await handler();}finally{b.disabled=false;}});return b;
}
function setHResult(id,msg,error=false){setMessage(id,msg,error);}
function coordinator(){return $("coordinator-name").value.trim()||"";}
function reviewCard(title,description,status){
  const card=elt("div","review-panel");card.append(hText("h4",title),hText("p",description),hText("span",status,"chip"));return card;
}
function planBars(id,plan){
  const target=$(id);target.replaceChildren();
  for(const v of plan.byVillage){
    const div=elt("div","allocation-row");
    const heading=elt("div","allocation-head");
    heading.append(hText("span",v.location),hText("strong",`${v.supplied} / ${v.demand} (${v.coveragePercent}%)`));
    const track=elt("div","bar-track"),bar=elt("div",`bar-fill ${plan.mode==='fair'?'fair':''}`);
    bar.style.width=`${Math.min(100,v.coveragePercent)}%`;
    track.append(bar);div.append(heading,track);target.append(div);
  }
}
function renderCompare(data){
  hurdleState.comparison=data;
  $("fair-demand").textContent=data.foodRequestsToServe;
  $("fair-stock").textContent=data.foodUnitsAvailable;
  $("fair-percent").textContent=data.coverageCapacityPercent+"%";
  $("fair-dups").textContent=data.pendingDuplicateReviews;
  $("fair-warning").textContent=data.pendingDuplicateReviews
    ? `⚠ ${data.pendingDuplicateReviews} potential duplicate pair(s) await human review. Demand includes both submissions; confirm a match to see 18/30 = 60%. No one is automatically excluded.`
    : `✓ Duplicate reviews completed. Current capacity: ${data.coverageCapacityPercent}%. Preview does not consume inventory.`;
  for(const mode of ["speed","fair"]){
    const plan=data[mode],el=$(mode+"-metrics");el.replaceChildren();
    for(const [label,value] of [["Planned allocations",plan.allocated],["Unserved",plan.unserved],["Min village coverage",plan.minVillageCoveragePercent+"%"],["Synthetic travel effort",plan.syntheticTravelKm+" km"]]){
      const box=elt("div");box.append(hText("span",label),hText("strong",value));el.append(box);
    }
    planBars(mode+"-bars",plan);
  }
  $("fair-tradeoff").textContent=`FairShare improves minimum village coverage by ${data.tradeoff.minVillageCoverageGainPoints} percentage points, with ${data.tradeoff.syntheticExtraKm} additional synthetic one-way km of aggregate effort.`;
  for(const mode of ["speed","fair"])$("approve-"+mode).disabled=!!data.requiresDuplicateReview||data.foodUnitsAvailable===0||data[mode].allocated===0;
}
async function loadCompare(){
  try{renderCompare(await hget("/fairshare/compare"));}
  catch(e){setHResult("fair-result",e.message,true);}
}
async function commitFair(mode){
  const reason=$("fair-reason").value.trim();
  if(!coordinator()||!reason)return setHResult("fair-result","Enter coordinator name on SOS page and an approval rationale.",true);
  if(!window.confirm(`SIMULATION: approve ${mode.toUpperCase()} plan and reserve food stock? This will change the fictional database.`))return;
  try{
    const result=await hpost("/fairshare/commit",{mode,coordinator:coordinator(),reason});
    setHResult("fair-result",`${result.approvedAssignments} fictional assignments approved. ${result.remainingInventory} food packs remain. ProofLoop still required for simulated resolution.`);
    await refreshAll();await loadCompare();
  }catch(e){setHResult("fair-result",e.message,true);}
}
async function loadDuplicates(){
  try{
    const response=await hget("/duplicates");hurdleState.duplicates=response;
    const target=$("duplicates-list");target.replaceChildren();
    for(const d of response.candidates){
      const status=d.review?.decision||"NEEDS HUMAN REVIEW";
      const card=reviewCard(`${d.first.name} ↔ ${d.second.name}`,
       `${d.first.camp} / ${d.second.camp} • ${d.first.location} • ${d.reasons.join(" • ")} • Similarity score ${d.score} (uncalibrated)`,status);
      const actions=elt("div","review-actions");
      const reason=elt("input");reason.maxLength=500;reason.value="Reviewed fictional camp records and supporting indicators";
      reason.setAttribute("aria-label","Duplicate review rationale");
      const save=async(decision)=>{
        if(!coordinator())return setHResult("duplicates-result","Enter a coordinator name on SOS Requests page.",true);
        try{
          await hpost("/duplicates/review",{firstId:d.firstId,secondId:d.secondId,decision,coordinator:coordinator(),reason:reason.value.trim()});
          setHResult("duplicates-result",`${decision.replaceAll('_',' ')} recorded. Original SOS submissions preserved.`);
          await loadDuplicates();await loadCompare();
        }catch(e){setHResult("duplicates-result",e.message,true);}
      };
      actions.append(reason,hButton("Same household",()=>save("SAME_HOUSEHOLD"),"primary-btn"),hButton("Different households",()=>save("DIFFERENT_HOUSEHOLDS")),hButton("Investigate later",()=>save("NEEDS_INVESTIGATION")));
      card.append(actions);target.append(card);
    }
    if(!response.candidates.length)target.append(hText("p","No strong candidate pairs with multiple matching indicators. This does not prove absence of duplicates."));
  }catch(e){setHResult("duplicates-result",e.message,true);}
}
async function loadClaims(){
  try{
    const response=await hget("/claims");hurdleState.claims=response;
    const target=$("claims-list");target.replaceChildren();
    for(const c of response.claims){
      const card=reviewCard(c.location,`Village estimate: ${c.reportedHouseholds} households • Current intake registrations: ${c.observedRegistrations} • Ratio: ${c.ratioReportedToRegistrations ?? "n/a"} • ${c.reason}`,`${c.flag} • ${c.status}`);
      const actions=elt("div","review-actions"),choice=elt("select"),number=elt("input"),note=elt("input");
      for(const [value,label] of [["NEEDS_MORE_EVIDENCE","More evidence needed"],["ACCEPTED_AS_REPORTED","Accept report for demo"],["CORRECTION_RECORDED","Record a reviewed correction"]])choice.add(new Option(label,value));
      number.type="number";number.min=0;number.max=100000;number.value=String(c.correctedHouseholds ?? c.reportedHouseholds);number.setAttribute("aria-label","Corrected household claim");
      note.value="Human-reviewed fictional report; registration coverage may be incomplete";note.maxLength=500;note.setAttribute("aria-label","Village claim review rationale");
      actions.append(choice,number,note,hButton("Save human review",async()=>{
        if(!coordinator())return setHResult("claims-result","Enter coordinator name on SOS Requests page.",true);
        try{await hpost(`/claims/${encodeURIComponent(c.id)}/review`,{status:choice.value,correctedHouseholds:Number(number.value),coordinator:coordinator(),reason:note.value.trim()});
          setHResult("claims-result","Review recorded. No household SOS was automatically rejected.");await loadClaims();}
        catch(e){setHResult("claims-result",e.message,true);}
      },"primary-btn"));card.append(actions);target.append(card);
    }
  }catch(e){setHResult("claims-result",e.message,true);}
}
async function loadPriority(){
  try{
    const response=await hget("/priority");hurdleState.priority=response;
    const target=$("priority-list");target.replaceChildren();
    for(const p of response.queue){
      const card=reviewCard(`${p.level} · ${p.name}`,`${p.location} • ${p.reason} • ${fmtStatus(p.status)} • Reviewed by: ${p.reviewedBy||"Nobody yet"}`,p.level==="P1"?"IMMEDIATE HUMAN REVIEW":p.level);
      const actions=elt("div","review-actions"),note=elt("input");note.value="Reviewed reported situation; professional emergency assessment still required";note.maxLength=500;note.setAttribute("aria-label","Human priority review rationale");
      actions.append(note,hButton("Record coordinator review",async()=>{
        if(!coordinator())return setHResult("priority-result","Enter coordinator name on SOS Requests page.",true);
        try{await hpost(`/priority/${encodeURIComponent(p.requestId)}/review`,{coordinator:coordinator(),note:note.value.trim()});setHResult("priority-result","Human assessment flag reviewed and logged. This is not medical clearance.");await loadPriority();}
        catch(e){setHResult("priority-result",e.message,true);}
      }));card.append(actions);target.append(card);
    }
  }catch(e){setHResult("priority-result",e.message,true);}
}
window.refreshHurdle=async(id)=>{
  if(id==="fairshare")await loadCompare();
  else if(id==="duplicates")await loadDuplicates();
  else if(id==="claims")await loadClaims();
  else if(id==="priority")await loadPriority();
};
$("fair-refresh").addEventListener("click",loadCompare);
$("approve-speed").addEventListener("click",()=>commitFair("speed"));
$("approve-fair").addEventListener("click",()=>commitFair("fair"));
$("demo-reset").addEventListener("click",async()=>{
  if(!window.confirm("Reset the LOCAL fictional demo? Existing simulated records will be backed up, and the scenario restored."))return;
  if(!window.confirm("Confirm RESET. This is only for your own local hackathon simulation."))return;
  try{await hpost("/demo/reset",{confirm:"RESET_SIMULATION"});await refreshAll();await loadCompare();setHResult("fair-result","Fictional challenge restored; previous database backed up locally.");}
  catch(e){setHResult("fair-result",e.message,true);openPage("fairshare");}
});
