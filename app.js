// Team BellaNova — LifeCrisis AI
// Real API integration. Everything here is SIMULATED, not a real rescue service.
"use strict";

const API = "/api";
const $ = (id) => document.getElementById(id);
const state = { requests: [], resources: [], assignments: [], proofs: [], events: [], gps: null, map: null, markers: null };
const titles = {
  dashboard: "Emergency Dashboard", sos: "SOS Requests", silentzone: "Equity / SilentZone",
  resources: "Resource Hub", failureshift: "FailureShift", proofloop: "ProofLoop",
  fairshare: "FairShare Lab", duplicates: "DuplicateShield", claims: "ClaimIntegrity", priority: "PriorityGuard"
};

function setMessage(id, message, error = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = message;
  el.classList.toggle("error", error);
  el.classList.toggle("success", !error);
}
function elt(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text; // Never inject text returned by the server as HTML.
  return node;
}
function fmtStatus(value) { return String(value || "UNKNOWN").replaceAll("_", " "); }
function shortId(id) { return String(id || "").slice(0, 8); }
function toTime(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleString();
}
function row(title, detail, badge, buttonLabel, onClick, badgeClass = "") {
  const outer = elt("div", "item-row");
  const left = elt("div");
  left.append(elt("strong", "", title), elt("p", "", detail));
  outer.append(left);
  const right = elt("div", "inline-actions");
  if (badge) right.append(elt("span", `chip ${badgeClass}`, fmtStatus(badge)));
  if (buttonLabel && onClick) {
    const btn = elt("button", "small-btn", buttonLabel);
    btn.type = "button";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try { await onClick(); }
      finally { btn.disabled = false; }
    });
    right.append(btn);
  }
  outer.append(right);
  return outer;
}
function fill(container, nodes, emptyText = "No records yet.") {
  const target = $(container);
  target.replaceChildren(...(nodes.length ? nodes : [elt("p", "empty", emptyText)]));
}
function fillSelect(id, records, labelFn, emptyLabel) {
  const element = $(id);
  const previousValue = element.value;
  element.replaceChildren();
  if (!records.length) {
    const option = new Option(emptyLabel, "");
    element.add(option);
    element.disabled = true;
    return;
  }
  element.disabled = false;
  for (const record of records) element.add(new Option(labelFn(record), record.id));
  if (records.some(r => r.id === previousValue)) element.value = previousValue;
}
async function callApi(path, options = {}) {
  let response;
  try {
    response = await fetch(API + path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
  } catch (_err) {
    const e = new Error("Backend unreachable. Submission will be saved locally and retried; it is NOT received by coordinators yet.");
    e.isNetworkFailure = true;
    throw e;
  }
  let payload;
  try { payload = await response.json(); }
  catch { throw new Error("Server returned an unexpected response."); }
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || `API error ${response.status}`);
  }
  return payload;
}
const post = (path, body) => callApi(path, { method: "POST", body: JSON.stringify(body) });
const QUEUE_KEY="LifeCrisisAI_SIMULATION_PENDING_SOS_V1";
function getQueue(){try{const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||"[]");return Array.isArray(q)?q:[];}catch{return [];}}
function putQueue(items){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(items));}catch{throw new Error("Cannot save offline SOS on this device; storage is unavailable.");}updateQueueStatus();}
function updateQueueStatus(){
  const count=getQueue().length;
  const banner=$("offline-banner");if(!banner)return;
  banner.firstChild.textContent=`${navigator.onLine?"Connection check available":"Device offline"} — ${count} SOS locally queued; NOT received by coordinators. `;
  $("queue-count").textContent=String(count);
}
let flushing=false;
async function flushQueue(){
  if(flushing)return;
  flushing=true;
  try{
    const queue=getQueue();let sent=0;
    for(const body of queue){
      try{
        await post("/requests",body);
        putQueue(getQueue().filter(q=>q.clientSubmissionId!==body.clientSubmissionId));sent++;
      }catch(error){
        if(!error.isNetworkFailure){
          // Keep the rejected record for manual correction, never erase it silently.
          setMessage("form-message",`Queued SOS needs manual review: ${error.message}`,true);
        }
        break;
      }
    }
    if(sent){setMessage("form-message",`${sent} queued fictional SOS received by backend. Sync completed.`);await refreshAll();}
  }finally{flushing=false;updateQueueStatus();}
}
function connected(ok) {
  $("connection-status").textContent = ok ? "● Backend connected" : "● Backend unreachable";
  $("connection-status").className = ok ? "online" : "offline";
  $("backend-health").textContent = ok ? "Connected" : "Offline — no API writes";
  $("backend-health").className = ok ? "green" : "red";
}
function openPage(id) {
  if (!titles[id]) return;
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("active", p.id === id));
  document.querySelectorAll(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.page === id));
  $("page-title").textContent = titles[id];
  if (id === "dashboard" && state.map) setTimeout(() => state.map.invalidateSize(), 0);
  if (window.refreshHurdle) window.refreshHurdle(id);
}

function renderDashboard(summary) {
  $("total-sos").textContent = summary.totalRequests;
  $("resolved").textContent = summary.resolvedRequests;
  $("responder-count").textContent = summary.availableRescueResources;
  $("resource-count").textContent = summary.availableResourceUnits;
  const recent = [...state.requests].sort((a,b) => String(b.createdAt||"").localeCompare(String(a.createdAt||""))).slice(0,8);
  fill("recent-requests", recent.map(r => row(
    `${shortId(r.id)} • ${r.type}`, `${r.location} • ${toTime(r.createdAt)}`, r.status, null, null,
    r.status === "DEMO_DELIVERY_CONFIRMED" ? "ok" : "warn"
  )), "No SOS requests in the backend yet.");
  fill("event-history", [...state.events].reverse().slice(0,12).map(e =>
    row(e.action, `${toTime(e.at)} • ${JSON.stringify(e.details || {})}`, "Logged")
  ), "No events yet. Create a simulated SOS to start the audit trail.");
}
function renderResources() {
  const nodes = state.resources.map(r => {
    const card = elt("div", "resource-card");
    card.append(elt("h3", "", r.name), elt("h2", "", String(r.quantity || 0)),
      elt("p", "", `${r.type} • ${fmtStatus(r.status)}`));
    return card;
  });
  fill("resource-grid", nodes, "No resources in the backend.");
}
function renderSOS() {
  const sorted = [...state.requests].sort((a,b) => String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
  fill("sos-list", sorted.map(r => row(
    `${shortId(r.id)} • ${r.name} • ${r.type}`,
    `${r.location} • ${fmtStatus(r.priority)} • ${toTime(r.createdAt)}`,
    r.status,
    ["OPEN", "NEEDS_REASSIGNMENT"].includes(r.status) ? "Find resources" : null,
    () => findResources(r.id),
    r.status === "DEMO_DELIVERY_CONFIRMED" ? "ok" : "warn"
  )), "No SOS cases. Create a fictional request above.");

  const pending = state.assignments.filter(a => a.status === "PENDING_APPROVAL");
  fill("approval-queue", pending.map(a => {
    const resource = state.resources.find(r => r.id === a.resourceId);
    const request = state.requests.find(r => r.id === a.requestId);
    return row(`Approve ${resource?.name || a.resourceId}`,
      `SOS ${shortId(a.requestId)} • ${request?.location || "Unknown location"} • Route unverified`,
      a.status, "Human approve", () => approveAssignment(a.id), "warn");
  }), "No proposals awaiting approval.");
}
async function findResources(requestId) {
  try {
    const result = await callApi(`/needgraph/${encodeURIComponent(requestId)}`);
    const target = $("needgraph-result");
    target.replaceChildren(elt("strong", "", `NeedGraph suggestions for SOS ${shortId(requestId)}`));
    if (!result.suggestions?.length) {
      target.append(elt("p", "", "No compatible stock. Escalate to a coordinator. Route safety is not verified."));
      return;
    }
    for (const suggestion of result.suggestions) {
      target.append(row(suggestion.resourceName, suggestion.reason, "Proposed only",
        "Create proposal", () => proposeAssignment(requestId, suggestion.resourceId)));
    }
  } catch (err) { setMessage("needgraph-result", err.message, true); }
}
async function proposeAssignment(requestId, resourceId) {
  try {
    await post("/assignments/propose", { requestId, resourceId });
    setMessage("needgraph-result", "Proposal stored. Human coordinator approval is required.");
    await refreshAll();
  } catch (err) { setMessage("needgraph-result", err.message, true); }
}
async function approveAssignment(id) {
  const coordinator = $("coordinator-name").value.trim();
  if (!coordinator) { setMessage("needgraph-result", "Enter a coordinator name first.", true); return; }
  try {
    await post(`/assignments/${encodeURIComponent(id)}/approve`, { coordinator });
    setMessage("needgraph-result", "Assignment approved by demo coordinator. It is NOT proof of completed rescue.");
    await refreshAll();
  } catch (err) { setMessage("needgraph-result", err.message, true); }
}
function renderFailureShift() {
  const approved = state.assignments.filter(a => a.status === "APPROVED");
  const requestById = Object.fromEntries(state.requests.map(r => [r.id, r]));
  fillSelect("failure-assignment", approved, a => {
    const resource = state.resources.find(r => r.id === a.resourceId);
    return `${resource?.name || a.resourceId} • ${requestById[a.requestId]?.location || shortId(a.requestId)}`;
  }, "No approved assignments — create and approve one on SOS page");
  fillSelect("analysis-request", state.requests, r => `${shortId(r.id)} • ${r.location}`, "No requests yet");
}
async function simulateFailure() {
  const id = $("failure-assignment").value;
  if (!id) { setMessage("alternative-result", "Create and approve a resource assignment on the SOS page first.", true); return; }
  try {
    const result = await post("/failureshift", { assignmentId: id, reason: $("failure-reason").value });
    const replacement = result.alternativeProposal || result.proposal;
    setMessage("alternative-result", replacement
      ? `Failure recorded. Backup proposal ${shortId(replacement.id)} is PENDING HUMAN APPROVAL. Go to SOS Requests → Coordinator Approval Queue.`
      : "Failure recorded. No compatible backup in stock. Escalate to a coordinator.");
    await refreshAll();
  } catch (err) { setMessage("alternative-result", err.message, true); }
}
async function viewFailure() {
  const id = $("analysis-request").value;
  if (!id) return;
  try {
    const [report, risk] = await Promise.all([
      callApi(`/failureshift/report/${encodeURIComponent(id)}`),
      callApi(`/failureshift/analysis/${encodeURIComponent(id)}`)
    ]);
    const target = $("failure-history");
    target.replaceChildren();
    for (const record of report.failureHistory || []) {
      target.append(row(record.resource, `Assignment: ${fmtStatus(record.status)} • Failure: ${record.failureReason || "None"} • Approved by: ${record.approvedBy || "Not approved"}`, record.status));
    }
    for (const item of risk.analysis || []) {
      target.append(row(`Human review: ${item.reason}`, `${item.impact}. Next check: ${item.recommendation}`, "Not verified", null, null, "warn"));
    }
    if (!(report.failureHistory || []).length) target.append(elt("p", "muted", "No assignments for this SOS yet."));
  } catch (err) { setMessage("failure-history", err.message, true); }
}
function renderProofLoop() {
  const approved = state.assignments.filter(a => a.status === "APPROVED");
  fillSelect("proof-assignment", approved, a => {
    const resource = state.resources.find(r => r.id === a.resourceId);
    const request = state.requests.find(r => r.id === a.requestId);
    return `${resource?.name || a.resourceId} • ${request?.location || shortId(a.requestId)}`;
  }, "No approved assignments to report");
  const pending = state.proofs.filter(p => p.status === "PENDING_VERIFICATION");
  fill("proof-queue", pending.map(p => row(`Proof ${shortId(p.id)}`,
    `Reporter: ${p.reportedBy || "Demo Responder"} • ${p.note || "No note"}`, p.status,
    "Human verify", () => verifyProof(p.id), "warn")), "No delivery reports awaiting human verification.");
}
async function reportDelivery() {
  const assignmentId = $("proof-assignment").value;
  if (!assignmentId) { setMessage("proof-result", "Approve an assignment first.", true); return; }
  const reportedBy = $("reporter-name").value.trim();
  const note = $("proof-note").value.trim();
  if (!reportedBy || !note) { setMessage("proof-result", "Reporter and note are required.", true); return; }
  try {
    const result = await post("/proofs", { assignmentId, reportedBy, note });
    setMessage("proof-result", `Report ${shortId(result.proof.id)} saved. Pending independent demo coordinator review.`);
    await refreshAll();
  } catch (err) { setMessage("proof-result", err.message, true); }
}
async function verifyProof(id) {
  const coordinator = $("coordinator-name").value.trim();
  if (!coordinator) { setMessage("proof-result", "Enter a coordinator name on the SOS page.", true); return; }
  try {
    await post(`/proofs/${encodeURIComponent(id)}/verify`, { coordinator });
    setMessage("proof-result", "Demo delivery attested by coordinator. No real-world delivery was independently verified.");
    await refreshAll();
  } catch (err) { setMessage("proof-result", err.message, true); }
}
async function refreshCoverage() {
  try {
    const result = await callApi("/equity");
    const areas = result.areas || result.underservedAreas || [];
    const target = $("scan-result");
    target.replaceChildren();
    for (const area of areas) target.append(row(area.location,
      `${area.unresolved} unresolved out of ${area.total} SOS cases`, "Count only"));
    target.append(elt("p", "muted", "This count is NOT a verified communication-outage map, fairness rating, or clinical risk score."));
  } catch (err) { setMessage("scan-result", err.message, true); }
}
function initializeMap() {
  if (typeof window.L === "undefined") {
    $("map-info").textContent = "Online map tiles unavailable (internet/CDN needed). The SOS list still works.";
    return;
  }
  state.map = L.map("emergency-map", { scrollWheelZoom: false }).setView([12.9716, 77.5946], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors", maxZoom: 19
  }).addTo(state.map);
  state.markers = L.layerGroup().addTo(state.map);
  renderMap();
}
function renderMap() {
  if (!state.map || !state.markers) return;
  state.markers.clearLayers();
  const bounds = [];
  for (const r of state.requests) {
    if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude) ||
        Math.abs(r.latitude) > 90 || Math.abs(r.longitude) > 180) continue;
    const confirmed = r.status === "DEMO_DELIVERY_CONFIRMED";
    const marker = L.circleMarker([r.latitude, r.longitude], {
      radius: 8, color: confirmed ? "#22c55e" : "#ef4444", fillOpacity: 0.85
    }).addTo(state.markers);
    const content = elt("div", "", `SOS ${shortId(r.id)} — ${r.location} — ${fmtStatus(r.status)} (SIMULATION)`);
    marker.bindPopup(content);
    bounds.push([r.latitude, r.longitude]);
  }
  $("map-info").textContent = bounds.length
    ? `${bounds.length} coordinate-backed SOS markers. Locations are user-submitted, not independently verified.`
    : "No SOS coordinates submitted yet. Use GPS on the SOS form to add a marker. No demo pins are fabricated.";
  if (bounds.length) state.map.fitBounds(bounds, { padding: [35, 35], maxZoom: 13 });
}
async function refreshAll() {
  try {
    const [summary, requests, resources, assignments, proofs, events] = await Promise.all([
      callApi("/summary"), callApi("/requests"), callApi("/resources"),
      callApi("/assignments"), callApi("/proofs"), callApi("/events")
    ]);
    state.requests = requests.requests || [];
    state.resources = resources.resources || [];
    state.assignments = assignments.assignments || [];
    state.proofs = proofs.proofs || [];
    state.events = events.events || [];
    connected(true);
    renderDashboard(summary);
    renderResources(); renderSOS(); renderFailureShift(); renderProofLoop(); renderMap();
    return true;
  } catch (err) {
    connected(false);
    setMessage("form-message", err.message, true);
    $("recent-requests").replaceChildren(elt("p", "empty", "Backend unavailable. Data not refreshed."));
    return false;
  }
}

// All event handlers are attached once; no duplicate UI requests on refresh.
document.querySelectorAll(".nav-link").forEach(a => a.addEventListener("click", e => {
  e.preventDefault(); openPage(a.dataset.page);
}));
document.querySelectorAll("[data-open]").forEach(btn => btn.addEventListener("click", () => openPage(btn.dataset.open)));
$("sos-form").addEventListener("submit", async e => {
  e.preventDefault();
  const submit = $("sos-submit"); submit.disabled = true;
  const body = {
    name: $("person-name").value.trim(), type: $("emergency-type").value,
    location: $("location").value.trim(), description: $("description").value.trim(),
    clientSubmissionId: typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`
  };
  const camp=$("camp").value.trim(), landmark=$("landmark").value.trim(), familySize=Number($("family-size").value);
  if(camp)body.camp=camp;
  if(landmark)body.landmark=landmark;
  if($("family-size").value.trim() && Number.isInteger(familySize))body.familySize=familySize;
  if (state.gps) { body.latitude = state.gps.latitude; body.longitude = state.gps.longitude; }
  try {
    // Persist BEFORE network submission, so a lost response/reload does not lose the request.
    putQueue([...getQueue(),body]);
    try {
      const result = await post("/requests",body);
      putQueue(getQueue().filter(q=>q.clientSubmissionId!==body.clientSubmissionId));
      setMessage("form-message", `SOS ${shortId(result.request.id)} received by BACKEND. Human triage pending. Simulation only.`);
      await refreshAll();
    } catch (err) {
      if(!err.isNetworkFailure){
        putQueue(getQueue().filter(q=>q.clientSubmissionId!==body.clientSubmissionId));
        throw err;
      }
      setMessage("form-message", "SOS SAVED ON THIS DEVICE ONLY. NOT received by coordinator. Auto-sync will retry when server returns.");
    }
    $("sos-form").reset();state.gps=null;$("gps-status").textContent="GPS optional.";
  } catch (err) { setMessage("form-message",err.message,true); }
  finally { submit.disabled = false;updateQueueStatus(); }
});
$("location").addEventListener("input", () => { state.gps = null; });
$("gps-btn").addEventListener("click", () => {
  if (!navigator.geolocation) { $("gps-status").textContent = "Geolocation unavailable in this browser."; return; }
  $("gps-status").textContent = "Requesting browser permission…";
  $("gps-btn").disabled = true;
  navigator.geolocation.getCurrentPosition(pos => {
    const latitude = pos.coords.latitude, longitude = pos.coords.longitude;
    state.gps = { latitude, longitude };
    $("location").value = `GPS: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    $("gps-status").textContent = "Coordinates captured with your permission. Submit only fictional/demo cases.";
    $("gps-btn").disabled = false;
  }, error => {
    $("gps-status").textContent = `GPS unavailable: ${error.message}. Enter a location manually.`;
    $("gps-btn").disabled = false;
  }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
});
$("alternative-btn").addEventListener("click", simulateFailure);
$("analysis-btn").addEventListener("click", viewFailure);
$("proof-btn").addEventListener("click", reportDelivery);
$("scan-btn").addEventListener("click", refreshCoverage);
window.addEventListener("online",async()=>{await flushQueue();await refreshAll();});
window.addEventListener("offline", () => {connected(false);updateQueueStatus();});
$("retry-sync").addEventListener("click",flushQueue);
if("serviceWorker" in navigator)navigator.serviceWorker.register("/sw.js").catch(()=>{});
initializeMap();
refreshAll().then(flushQueue);
updateQueueStatus();
setInterval(flushQueue,15000);
