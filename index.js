// LifeCrisis AI | Team BellaNova | Local flood-relief SIMULATION
// This demo does NOT contact emergency responders or confirm real deliveries.
const express = require("express");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3001);
const DB_PATH = process.env.LIFECRISIS_DB_PATH ? path.resolve(process.env.LIFECRISIS_DB_PATH) : path.join(__dirname, "data", "db.json");

app.use(express.json({ limit: "20kb" }));
// In this two-laptop private-LAN demo, only the host computer may perform coordinator writes.
// The teammate's computer can submit SOS, but cannot approve/resolve/change FairShare.
function isHost(req) { return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket?.remoteAddress); }
app.use((req,res,next)=>{
  if(req.method !== "GET" && req.path.startsWith("/api/") && req.path !== "/api/live/sos" && !isHost(req)) {
    return res.status(403).json({success:false,message:"Coordinator changes must be made on the server laptop using localhost."});
  }
  next();
});
app.use("/api/",(req,res,next)=>{res.setHeader("Cache-Control","no-store");next();});

// Serve ONLY these frontend files. Do not expose index.js, data/db.json or .env.
app.get("/", (req, res) => res.redirect(302,"/sos-signal.html"));
for (const name of ["style.css", "app.js", "hurdle-ui.js", "sw.js", "sos-signal.html", "coordinator.html", "live-ui.js", "live-ui.css"]) {
  app.get(`/${name}`, (req, res) => {res.setHeader("Cache-Control","no-store");res.sendFile(path.join(__dirname, name));});
}
app.get("/index.html",(req,res)=>res.redirect(302,"/sos-signal.html"));



// SOS-ONLY DONATION QR
app.get('/donation-qr.png',(req,res)=>{
 const f=path.join(__dirname,'donation-qr.png');
 res.setHeader('Cache-Control','no-store');
 if(!fs.existsSync(f))return res.status(404).end();
 res.type('png').sendFile(f)
});
app.post('/api/donation/qr',express.raw({type:'image/png',limit:'1mb'}),(req,res)=>{
 if(!isHost(req))return res.status(403).json({success:false,message:'Host-only upload'});
 const b=req.body,sig=Buffer.from([137,80,78,71,13,10,26,10]);
 if(!Buffer.isBuffer(b)||b.length<50||b.length>1048576||!b.subarray(0,8).equals(sig))
  return res.status(400).json({success:false,message:'Upload a valid PNG under 1 MB'});
 try{
  const f=path.join(__dirname,'donation-qr.png');
  fs.writeFileSync(f+'.pending',b);
  fs.renameSync(f+'.pending',f);
  res.json({success:true})
 }catch(e){
  res.status(500).json({success:false,message:'Unable to save QR'})
 }
});

// First run: initialize a fictional demo DB only when there is no existing data.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
if (!fs.existsSync(DB_PATH)) {
  // Manual SOS entry only; preserve original 60% sample separately in seed.json.
  fs.copyFileSync(path.join(__dirname, "data", "initial.json"), DB_PATH);
}
function readDB() {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  for (const key of ["requests", "resources", "assignments", "disruptions", "proofs", "events", "duplicateReviews", "villageClaims"]) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  return db;
}

let currentRevision = 0;
const liveListeners = new Set();
function saveDB(db) {
  const tmp = DB_PATH + ".pending";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
  currentRevision++;
  for (const listener of liveListeners) { try { listener.write(`event: changed\ndata: ${currentRevision}\n\n`); } catch { liveListeners.delete(listener); } }
}

function logEvent(db, action, details) {
  db.events.push({ id: randomUUID(), action, details, at: new Date().toISOString() });
}

function matches(db, request) {
  return db.resources.filter((resource) =>
    resource.status === "AVAILABLE" &&
    Number(resource.quantity) > 0 &&
    (resource.type === request.type ||
      (request.type === "Natural Disaster" && resource.type === "Rescue Assistance"))
  );
}

// Catch errors from local file reading/writing in a consistent way.
const safe = (handler) => (req, res) => {
  try { handler(req, res); }
  catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Local demo database error" });
  }
};


app.get("/api/status", (req, res) => {
  res.json({ success: true, system: "LifeCrisis AI", mode: "SIMULATION", status: "active" });
});

// Keep the POST test you already built working.
app.post("/api/data", (req, res) => {
  res.json({ success: true, message: "Data received successfully!", data: req.body });
});

// 1. SOS requests and inventory
app.get("/api/requests", safe((req, res) => {
  const db = readDB();
  res.json({ success: true, totalRequests: db.requests.length, requests: db.requests });
}));

app.post("/api/requests", safe((req, res) => {
  const { name, type, location, description } = req.body || {};
  const clientSubmissionId = req.body?.clientSubmissionId;
  if(clientSubmissionId !== undefined && (typeof clientSubmissionId !== "string" || clientSubmissionId.length > 120 || clientSubmissionId.length < 10)) return res.status(400).json({success:false,message:"Invalid stable submission ID"});
  if (![name, type, location, description].every((value) =>
    typeof value === "string" && value.trim().length > 0 && value.length <= 500)) {
    return res.status(400).json({ success: false, message: "Enter name, type, location and description (max 500 characters each)" });
  }
  const db = readDB();
  if(clientSubmissionId){ const existing=db.requests.find(r=>r.clientSubmissionId===clientSubmissionId); if(existing)return res.json({success:true,simulation:true,replayed:true,request:existing}); }
  const request = {
    clientSubmissionId:clientSubmissionId || undefined,
    id: randomUUID(), name: name.trim(), type: type.trim(),
    location: location.trim(), description: description.trim(),
    priority: "PENDING_HUMAN_TRIAGE", status: "OPEN",
    createdAt: new Date().toISOString()
  };
  const latitude = req.body?.latitude, longitude = req.body?.longitude;
  if (latitude !== undefined || longitude !== undefined) {
    if (typeof latitude !== "number" || typeof longitude !== "number" ||
        !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return res.status(400).json({ success: false, message: "Valid latitude and longitude are both required" });
    }
    request.latitude = latitude;
    request.longitude = longitude;
  }
  for (const key of ["camp", "landmark"]) if(typeof req.body?.[key]==="string" && req.body[key].length<=120) request[key]=req.body[key].trim();
  if(Number.isInteger(req.body?.familySize) && req.body.familySize>0 && req.body.familySize<=100)request.familySize=req.body.familySize;
  db.requests.push(request);
  logEvent(db, "SOS_CREATED", { requestId: request.id });
  saveDB(db);
  res.status(201).json({ success: true, simulation: true, request });
}));

app.get("/api/resources", safe((req, res) => {
  res.json({ success: true, resources: readDB().resources });
}));

app.get("/api/summary", safe((req, res) => {
  const db = readDB();
  res.json({
    success: true, simulation: true,
    totalRequests: db.requests.length,
    resolvedRequests: db.requests.filter(r => r.status === "DEMO_DELIVERY_CONFIRMED").length,
    availableRescueResources: db.resources.filter(r =>
      r.status === "AVAILABLE" && r.type === "Rescue Assistance" && Number(r.quantity) > 0
    ).length,
    availableResourceUnits: db.resources.filter(r => r.status === "AVAILABLE")
      .reduce((sum, r) => sum + Number(r.quantity || 0), 0)
  });
}));

app.get("/api/assignments", safe((req, res) => {
  res.json({ success: true, assignments: readDB().assignments });
}));
app.get("/api/proofs", safe((req, res) => {
  res.json({ success: true, proofs: readDB().proofs });
}));

// 2. NeedGraph: explainable compatibility matching, NOT live GPS or route checking.
app.get("/api/needgraph/:requestId", safe((req, res) => {
  const db = readDB();
  const request = db.requests.find((item) => item.id === req.params.requestId);
  if (!request) return res.status(404).json({ success: false, message: "SOS not found" });
  const suggestions = matches(db, request).map((resource) => ({
    resourceId: resource.id,
    resourceName: resource.name,
    reason: "Compatible emergency type and available inventory; route not verified"
  }));
  res.json({ success: true, requestId: request.id, suggestions, humanApprovalRequired: true });
}));

// Create a proposal: no rescue resource is assigned until coordinator approval.
app.post("/api/assignments/propose", safe((req, res) => {
  const db = readDB();
  const request = db.requests.find((item) => item.id === req.body?.requestId);
  if (!request) return res.status(404).json({ success: false, message: "SOS not found" });
  if (!["OPEN", "NEEDS_REASSIGNMENT"].includes(request.status)) {
    return res.status(409).json({ success: false, message: "Request is not awaiting assignment" });
  }
  if (db.assignments.some(a => a.requestId === request.id && a.status === "PENDING_APPROVAL")) {
    return res.status(409).json({ success: false, message: "This SOS already has a pending proposal" });
  }
  if(linkedCanonical(db,request.id)!==request.id)return res.status(409).json({success:false,message:"This record is linked as a coordinator-confirmed repeat household. Review the canonical case before distributing again."});
  const candidates = matches(db, request);
  const resource = req.body?.resourceId
    ? candidates.find(r => r.id === req.body.resourceId)
    : candidates[0];
  if (!resource) return res.status(409).json({ success: false, message: "No compatible resource is currently available" });
  const assignment = {
    id: randomUUID(), requestId: request.id, resourceId: resource.id,
    status: "PENDING_APPROVAL", createdAt: new Date().toISOString()
  };
  db.assignments.push(assignment);
  logEvent(db, "ASSIGNMENT_PROPOSED", { assignmentId: assignment.id });
  saveDB(db);
  res.status(201).json({ success: true, assignment, reason: "Compatible type and positive stock; feasibility must be checked by coordinator" });
}));

app.post("/api/assignments/:id/approve", safe((req, res) => {
  const coordinator = req.body?.coordinator;
  if (typeof coordinator !== "string" || !coordinator.trim()) {
    return res.status(400).json({ success: false, message: "Coordinator name required" });
  }
  const db = readDB();
  const assignment = db.assignments.find((item) => item.id === req.params.id);
  if (!assignment) return res.status(404).json({ success: false, message: "Assignment not found" });
  if (assignment.status !== "PENDING_APPROVAL") return res.status(409).json({ success: false, message: "Assignment already processed" });
  const resource = db.resources.find((item) => item.id === assignment.resourceId);
  const request = db.requests.find((item) => item.id === assignment.requestId);
  if(request && linkedCanonical(db,request.id)!==request.id) return res.status(409).json({success:false,message:"Human-linked repeat record; cannot allocate twice to the same household."});
  if (!resource || !request || resource.status !== "AVAILABLE" || Number(resource.quantity) < 1) {
    return res.status(409).json({ success: false, message: "Resource unavailable; run FailureShift or review inventory" });
  }
  if (db.assignments.some((a) => a.requestId === request.id && a.id !== assignment.id && ["APPROVED", "DELIVERY_REPORTED", "DELIVERED"].includes(a.status))) {
    return res.status(409).json({ success: false, message: "SOS already has an active assignment" });
  }
  resource.quantity -= 1;
  if (resource.quantity === 0) resource.status = "ALLOCATED";
  assignment.status = "APPROVED";
  assignment.approvedBy = coordinator.trim();
  request.status = "ASSIGNED";
  logEvent(db, "HUMAN_APPROVED", { assignmentId: assignment.id, coordinator: coordinator.trim() });
  saveDB(db);
  res.json({ success: true, assignment, message: "Demo coordinator approved the proposal" });
}));

// 3. FailureShift: mark the primary resource failed and propose a replacement.
app.post("/api/failureshift", safe((req, res) => {
  const db = readDB();
  const assignment = db.assignments.find((item) => item.id === req.body?.assignmentId);
  if (!assignment || assignment.status !== "APPROVED") {
    return res.status(400).json({ success: false, message: "Provide an approved assignmentId" });
  }
  const resource = db.resources.find((item) => item.id === assignment.resourceId);
  const request = db.requests.find((item) => item.id === assignment.requestId);
  if (!resource || !request) return res.status(404).json({ success: false, message: "Related record missing" });
  resource.status = "UNAVAILABLE";   // Simulated disruption (not a real-world alert)
  assignment.status = "FAILED";
  request.status = "NEEDS_REASSIGNMENT";
  const allowedReasons = ["ENGINE_BREAKDOWN", "FUEL_SHORTAGE", "ROUTE_BLOCKED", "COMMUNICATION_FAILURE", "OTHER_SIMULATED_FAILURE"];
  const reason = allowedReasons.includes(req.body?.reason) ? req.body.reason : "OTHER_SIMULATED_FAILURE";
  const disruption = { id: randomUUID(), assignmentId: assignment.id, reason, at: new Date().toISOString() };
  db.disruptions.push(disruption);
  const replacement = matches(db, request)[0];
  let proposal = null;
  if (replacement) {
    proposal = { id: randomUUID(), requestId: request.id, resourceId: replacement.id, status: "PENDING_APPROVAL", createdAt: new Date().toISOString() };
    db.assignments.push(proposal);
  }
  logEvent(db, "FAILURESHIFT_TRIGGERED", { disruptionId: disruption.id, replacementProposed: Boolean(proposal) });
  saveDB(db);
  res.json({ success: true, disruption, proposal, alternativeProposal: proposal, humanApprovalRequired: true,
    explanation: proposal ? "Compatible backup found; coordinator must assess route and approve" : "No compatible backup; escalate to coordinator" });
}));

// 4. ProofLoop: delivery report first, coordinator attestation second.
app.post("/api/proofs", safe((req, res) => {
  const { assignmentId, reportedBy, note } = req.body || {};
  if (typeof reportedBy !== "string" || !reportedBy.trim() || typeof note !== "string" || !note.trim()) {
    return res.status(400).json({ success: false, message: "reportedBy and note are required" });
  }
  const db = readDB();
  const assignment = db.assignments.find((item) => item.id === assignmentId);
  if (!assignment || assignment.status !== "APPROVED") return res.status(409).json({ success: false, message: "Approved assignment required" });
  const proof = { id: randomUUID(), assignmentId, reportedBy: reportedBy.trim(), note: note.trim().slice(0, 500), status: "PENDING_VERIFICATION", at: new Date().toISOString() };
  db.proofs.push(proof);
  assignment.status = "DELIVERY_REPORTED";
  db.requests.find((item) => item.id === assignment.requestId).status = "DELIVERY_REPORTED";
  logEvent(db, "DELIVERY_REPORTED", { proofId: proof.id });
  saveDB(db);
  res.status(201).json({ success: true, proof, message: "Simulation report recorded; delivery not yet verified" });
}));

app.post("/api/proofs/:id/verify", safe((req, res) => {
  const coordinator = req.body?.coordinator;
  if (typeof coordinator !== "string" || !coordinator.trim()) return res.status(400).json({ success: false, message: "Coordinator name required" });
  const db = readDB();
  const proof = db.proofs.find((item) => item.id === req.params.id);
  if (!proof || proof.status !== "PENDING_VERIFICATION") return res.status(404).json({ success: false, message: "Pending demo proof not found" });
  proof.status = "DEMO_COORDINATOR_CONFIRMED";
  proof.verifiedBy = coordinator.trim();
  const assignment = db.assignments.find((item) => item.id === proof.assignmentId);
  assignment.status = "DELIVERED";
  db.requests.find((item) => item.id === assignment.requestId).status = "DEMO_DELIVERY_CONFIRMED";
  logEvent(db, "DEMO_DELIVERY_CONFIRMED", { proofId: proof.id, coordinator: coordinator.trim() });
  saveDB(db);
  res.json({ success: true, proof, message: "Demo coordinator attested delivery; not independent real-world proof" });
}));

// 5. Equity Lens: display unresolved request counts by area (not an AI fairness judgment).
app.get("/api/equity", safe((req, res) => {
  const db = readDB();
  const byArea = {};
  for (const request of db.requests) {
    const area = request.location;
    if (!byArea[area]) byArea[area] = { location: area, total: 0, unresolved: 0, demoConfirmed: 0 };
    byArea[area].total += 1;
    if (request.status === "DEMO_DELIVERY_CONFIRMED") byArea[area].demoConfirmed += 1;
    else byArea[area].unresolved += 1;
  }
  const areas = Object.values(byArea).sort((a, b) => b.unresolved - a.unresolved);
  res.json({ success: true, areas, note: "Counts for demo visibility only; not a validated fairness or vulnerability score" });
}));

app.get("/api/events", safe((req, res) => {
  res.json({ success: true, events: readDB().events });
}));

// An explainable read-only failure report for a specific SOS.
app.get("/api/failureshift/report/:id", safe((req, res) => {
  const db = readDB();
  const request = db.requests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ success: false, message: "SOS not found" });
  const failureHistory = db.assignments.filter(a => a.requestId === request.id).map(a => {
    const resource = db.resources.find(r => r.id === a.resourceId);
    const disruption = db.disruptions.find(d => d.assignmentId === a.id);
    return {
      assignmentId: a.id, resourceId: a.resourceId,
      resource: resource?.name || a.resourceId, status: a.status,
      failureReason: disruption?.reason || null,
      approvedBy: a.approvedBy || null,
      routeVerified: false
    };
  });
  res.json({ success: true, feature: "FailureShift Investigation", simulation: true,
    caseId: request.id, location: request.location, failureHistory });
}));

app.get("/api/failureshift/analysis/:id", safe((req, res) => {
  const db = readDB();
  const request = db.requests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ success: false, message: "SOS not found" });
  const ids = new Set(db.assignments.filter(a => a.requestId === request.id).map(a => a.id));
  const guidance = {
    ENGINE_BREAKDOWN: ["Boat may be inoperable", "Verify another rescue boat and its safety"],
    FUEL_SHORTAGE: ["Boat may not complete the journey", "Check fuel supply and alternative resources"],
    ROUTE_BLOCKED: ["Planned rescue route may be unsafe", "Request a human route assessment"],
    COMMUNICATION_FAILURE: ["Responder contact may be lost", "Escalate for manual contact verification"]
  };
  const analysis = db.disruptions.filter(d => ids.has(d.assignmentId)).map(d => {
    const [impact, recommendation] = guidance[d.reason] ||
      ["Rescue resource unavailable", "Review backup availability"];
    return { failureId: d.id, reason: d.reason, impact, recommendation, humanReviewRequired: true };
  });
  res.json({ success: true, agent: "FailureShift Risk Analysis", requestId: request.id,
    simulation: true, analysis, message: "All recommendations require human verification" });
}));

app.get("/api/passport/:id", safe((req, res) => {
  const db = readDB();
  const request = db.requests.find(r => r.id === req.params.id);
  if (!request) return res.status(404).json({ success: false, message: "SOS not found" });
  const assignments = db.assignments.filter(a => a.requestId === request.id);
  const ids = new Set(assignments.map(a => a.id));
  res.json({ success: true, feature: "Decision Passport", simulation: true,
    requestId: request.id, status: request.status,
    assignments, disruptions: db.disruptions.filter(d => ids.has(d.assignmentId)),
    proofs: db.proofs.filter(p => ids.has(p.assignmentId)),
    humanApprovalRequired: true, routeVerified: false, actualRescueVerified: false });
}));

// 6. THE SURPRISE HURDLE: FAIR SHARES & DOUBLE CLAIMS.
// Transparent, deterministic decision support with manual oversight; demo-only.
const { FOOD, MODELS, classifyPriority, linkedCanonical, candidateDuplicates, claimSignals, compareAllocations } = require("./services/hurdle");

app.get("/api/priority", safe((req, res) => {
  const db = readDB();
  const queue = db.requests.filter(r=>r.status !== "DEMO_DELIVERY_CONFIRMED")
    .map(r=>({requestId:r.id,name:r.name,location:r.location,status:r.status,reviewedBy:r.triageReviewedBy || null,...classifyPriority(r)}))
    .sort((a,b)=>["P1","P2","P3","P4"].indexOf(a.level)-["P1","P2","P3","P4"].indexOf(b.level));
  res.json({success:true,simulation:true,queue,note:"Provisional text flags only. No clinical triage or verified medical assessment."});
}));

app.post("/api/priority/:id/review", safe((req, res) => {
  const coordinator = String(req.body?.coordinator || "").trim();
  const note = String(req.body?.note || "").trim();
  if(!coordinator || !note || coordinator.length > 100 || note.length > 500) return res.status(400).json({success:false,message:"Coordinator and review note required (up to 100/500 characters)."});
  const db = readDB(), r=db.requests.find(r=>r.id===req.params.id);
  if(!r) return res.status(404).json({success:false,message:"SOS not found"});
  r.triageReviewedBy=coordinator;
  r.triageReviewNote=note;
  r.triageReviewedAt=new Date().toISOString();
  logEvent(db,"HUMAN_PRIORITY_REVIEWED",{requestId:r.id,coordinator,note});
  saveDB(db); res.json({success:true,requestId:r.id,triage:classifyPriority(r),humanReviewedBy:coordinator});
}));

app.get("/api/duplicates", safe((req,res)=>{
  const db=readDB();
  res.json({success:true,simulation:true,candidates:candidateDuplicates(db),reviews:db.duplicateReviews,note:"Candidate match is never an automatic denial or confirmed identity."});
}));

app.post("/api/duplicates/review", safe((req,res)=>{
  const {firstId,secondId,decision}=req.body||{};
  const coordinator=String(req.body?.coordinator||"").trim();
  const reason=String(req.body?.reason||"").trim();
  if(!["SAME_HOUSEHOLD","DIFFERENT_HOUSEHOLDS","NEEDS_INVESTIGATION"].includes(decision)||!coordinator||!reason||reason.length>500) return res.status(400).json({success:false,message:"Provide valid decision, coordinator and rationale."});
  const db=readDB();
  const candidate=candidateDuplicates(db).find(p=>[p.firstId,p.secondId].sort().join("|")===[firstId,secondId].sort().join("|"));
  if(!candidate) return res.status(404).json({success:false,message:"Candidate pair not found"});
  const activeAssignments=db.assignments.filter(a=>[firstId,secondId].includes(a.requestId)&&["APPROVED","DELIVERY_REPORTED","DELIVERED"].includes(a.status));
  if(decision==="SAME_HOUSEHOLD" && activeAssignments.length>0) return res.status(409).json({success:false,message:"Already assigned: investigate existing delivery records before linking households."});
  const pairKey=[firstId,secondId].sort().join("|");
  db.duplicateReviews=db.duplicateReviews.filter(r=>[r.firstId,r.secondId].sort().join("|")!==pairKey);
  const review={firstId,secondId,decision,coordinator,reason,at:new Date().toISOString()};
  db.duplicateReviews.push(review);
  logEvent(db,"DUPLICATE_HUMAN_REVIEW",{firstId,secondId,decision,coordinator,reason});
  saveDB(db); res.json({success:true,review,note:"Both raw records preserved. No help was automatically denied."});
}));

app.get("/api/claims", safe((req,res)=>{
  res.json({success:true,simulation:true,claims:claimSignals(readDB()),note:"Discrepancies invite investigation; registrations are not verified population totals or evidence of fraud."});
}));

app.post("/api/claims/:id/review", safe((req,res)=>{
  const db=readDB(); const claim=db.villageClaims.find(c=>c.id===req.params.id);
  if(!claim) return res.status(404).json({success:false,message:"Village claim not found"});
  const {status,correctedHouseholds}=req.body||{};
  const coordinator=String(req.body?.coordinator||"").trim();
  const reason=String(req.body?.reason||"").trim();
  if(!["NEEDS_MORE_EVIDENCE","ACCEPTED_AS_REPORTED","CORRECTION_RECORDED"].includes(status)||!coordinator||!reason||reason.length>500) return res.status(400).json({success:false,message:"Provide valid status, coordinator and rationale."});
  if(status==="CORRECTION_RECORDED"&&(!Number.isInteger(correctedHouseholds)||correctedHouseholds<0||correctedHouseholds>100000)) return res.status(400).json({success:false,message:"Provide valid corrected household count."});
  claim.status=status; claim.reviewedBy=coordinator; claim.reviewReason=reason; claim.reviewedAt=new Date().toISOString();
  if(status==="CORRECTION_RECORDED")claim.correctedHouseholds=correctedHouseholds;
  logEvent(db,"CLAIM_HUMAN_REVIEW",{claimId:claim.id,status,coordinator,reason});
  saveDB(db); res.json({success:true,claim,note:"Claim investigation never automatically removes household requests."});
}));

app.get("/api/fairshare/compare", safe((req,res)=>res.json(compareAllocations(readDB()))));

// Coordinator-approved bulk assignment; no stock consumed during mere preview.
app.post("/api/fairshare/commit", safe((req,res)=>{
  const mode=req.body?.mode,coordinator=String(req.body?.coordinator||"").trim(),reason=String(req.body?.reason||"").trim();
  if(!MODELS.has(mode)||!coordinator||!reason||reason.length>500) return res.status(400).json({success:false,message:"Mode (speed or fair), coordinator and rationale are required."});
  const db=readDB(), comp=compareAllocations(db);
  if(comp.pendingDuplicateReviews) return res.status(409).json({success:false,message:"Review all potential duplicate households before approving scarce-supply allocation."});
  const plan=comp[mode];
  if(!plan.allocations.length) return res.status(409).json({success:false,message:"No unallocated compatible supply available."});
  const resource=db.resources.find(r=>r.id==="food-01");
  if(!resource||resource.status!=="AVAILABLE"||resource.quantity<plan.allocations.length) return res.status(409).json({success:false,message:"Inventory changed; refresh plan."});
  // Another assignment can exist even when a request remains OPEN because of malformed history. Refuse rather than double-commit.
  if(plan.allocations.some(p=>db.assignments.some(a=>a.requestId===p.requestId && ["PENDING_APPROVAL","APPROVED","DELIVERY_REPORTED","DELIVERED"].includes(a.status)))) return res.status(409).json({success:false,message:"Some selected requests already have assignments; review the queue."});
  const at=new Date().toISOString(), created=[];
  for(const p of plan.allocations){
    const r=db.requests.find(r=>r.id===p.requestId);
    if(!r||r.status!=="OPEN"||r.type!==FOOD) return res.status(409).json({success:false,message:"SOS state changed; preview again."});
    const assignment={id:randomUUID(),requestId:r.id,resourceId:resource.id,status:"APPROVED",approvedBy:coordinator,approvalReason:reason,allocationMode:mode,createdAt:at};
    created.push(assignment);
  }
  for(const a of created){db.assignments.push(a);db.requests.find(r=>r.id===a.requestId).status="ASSIGNED";}
  resource.quantity-=created.length;
  if(resource.quantity===0)resource.status="ALLOCATED";
  logEvent(db,"FAIRSHARE_HUMAN_APPROVED",{mode,coordinator,reason,count:created.length,syntheticTravelKm:plan.syntheticTravelKm});
  saveDB(db);
  res.json({success:true,simulation:true,approvedAssignments:created.length,mode,remainingInventory:resource.quantity,note:"Coordinator-approved simulated allocations; not actual delivered relief. ProofLoop required to count resolution."});
}));

// Explicitly destructive local demo reset; back up previous simulated database.
app.post("/api/demo/reset",safe((req,res)=>{
  if(req.body?.confirm!=="RESET_SIMULATION")return res.status(400).json({success:false,message:"Explicit RESET_SIMULATION confirmation required"});
  if(fs.existsSync(DB_PATH)) {
    const backup=path.join(path.dirname(DB_PATH),`backup-${Date.now()}.json`);
    fs.copyFileSync(DB_PATH,backup);
  }
  fs.copyFileSync(path.join(__dirname,"data","seed.json"),DB_PATH);
  res.json({success:true,simulation:true,message:"Fictional challenge restored. Previous DB backed up locally."});
}));

require("./services/live").mount(app, { readDB, saveDB, logEvent, safe, liveListeners, getRevision:()=>currentRevision });
app.listen(PORT, process.env.HOST || "0.0.0.0", () => {
  console.log(`LifeCrisis AI demo server running on http://localhost:${PORT}`);
  console.log(`Teammate SOS: http://YOUR_PRIVATE_IPV4:${PORT}/sos-signal.html`);
  console.log("Coordinator: http://localhost:3001/coordinator.html");
  console.log("SIMULATION ONLY. Trusted private LAN. Host-only coordinator actions; do not port-forward.");
});
