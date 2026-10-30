// BellaNova | Team A frontend demonstration
// Data is stored only in this browser until the backend API is connected.

const STORAGE_KEY = "bellanova_demo_sos";
let requests = [];
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  requests = Array.isArray(saved) ? saved : [];
} catch (_) {
  requests = [];
}

function saveRequests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
}

function showPage(pageId) {
  document.querySelectorAll(".page").forEach((page) => {
    page.classList.toggle("active", page.id === pageId);
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.page === pageId);
  });
  const title = document.getElementById("page-title");
  const titles = {
    dashboard: "Emergency Dashboard",
    sos: "SOS Requests",
    silentzone: "SilentZone Monitoring",
    resources: "Resource Hub",
    failureshift: "FailureShift",
    proofloop: "ProofLoop"
  };
  if (title) title.textContent = titles[pageId] || "BellaNova";
}

function updateDashboard() {
  document.getElementById("total-sos").textContent = requests.length;
  const resolved = document.getElementById("resolved");
  if (resolved) {
    resolved.textContent = requests.filter((req) => req.status === "DEMO_DELIVERY_CONFIRMED").length;
  }
  const recent = document.getElementById("recent-requests");
  recent.replaceChildren();
  if (!requests.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No emergency requests submitted yet.";
    recent.append(empty);
    return;
  }
  requests.slice(-5).reverse().forEach((req) => {
    const row = document.createElement("p");
    row.textContent = `${req.type} — ${req.location} — ${req.status.replaceAll("_", " ")}`;
    recent.append(row);
  });
}

document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    showPage(link.dataset.page);
  });
});

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.open));
});

document.getElementById("sos-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("person-name").value.trim();
  const type = document.getElementById("emergency-type").value;
  const location = document.getElementById("location").value.trim();
  const description = document.getElementById("description").value.trim();
  if (!name || !type || !location || !description) return;

  requests.push({
    id: Date.now().toString(),
    name, type, location, description,
    status: "DEMO_REQUEST_REGISTERED",
    createdAt: new Date().toISOString()
  });
  saveRequests();
  updateDashboard();
  document.getElementById("form-message").textContent =
    "Demo SOS saved in this browser. It has NOT been sent to emergency services.";
  event.target.reset();
});

document.getElementById("scan-btn").addEventListener("click", () => {
  document.getElementById("scan-result").textContent =
    "Demo scan: Hillview Village has not reported an update for 12 hours. " +
    "Potential communication gap — requires human verification.";
});

document.getElementById("alternative-btn").addEventListener("click", () => {
  document.getElementById("alternative-result").textContent =
    "Demo FailureShift: Primary rescue boat unavailable. " +
    "Proposed alternative: check nearby rescue teams and obtain coordinator approval.";
});

document.getElementById("proof-btn").addEventListener("click", () => {
  const latest = [...requests].reverse().find((req) => req.status === "DEMO_REQUEST_REGISTERED");
  const result = document.getElementById("proof-result");
  if (!latest) {
    result.textContent = "Submit a demo SOS first. No unconfirmed requests found.";
    return;
  }
  latest.status = "DEMO_DELIVERY_CONFIRMED";
  saveRequests();
  updateDashboard();
  result.textContent = "Simulated delivery confirmed for " + latest.location +
    ". This is not proof of a real rescue.";
});

updateDashboard();
showPage("dashboard");
