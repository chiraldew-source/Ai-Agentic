# LifeCrisis AI — FairShare & Double Claims Edition

**Team BellaNova · Agentic AI & Multi-Agent hackathon · DEMONSTRATION ONLY**

This is a **rule-based emergency coordination simulation** with separate deterministic decision-support modules, not a live emergency rescue dispatch service or a validated clinical triage tool. Every identity, village, coordinate, resource allocation and verified outcome in the supplied demo seed is fictional. No real rescue is verified.

## Start it on Windows (the simple way)

1. **Keep your old `hackathon-backend` folder**. This is a separate updated version.
2. Extract the ZIP. Open its **`lifecrisis-fairshare`** folder in VS Code using **File → Open Folder**.
3. Stop your old Node server first if it is still using port 3001 (`Ctrl+C` in the old terminal).
4. Open **Terminal → New Terminal** in the extracted folder.
5. Run **`npm install`** (internet required once) and then **`npm start`**.
6. Visit **http://localhost:3001/** in your browser. **Do not double-click `index.html`**; it must be served by Node.

**If port 3001 is occupied:** stop the old Node process before starting this version. If you still get an error, share the exact terminal message.

## The surprise hurdle (interactive judge demo)

The seed supplies **18 food relief packs**. There are **31 raw food SOS submissions**, including one *possible* repeat registration. The software does **not silently discard** the suspected duplicate. Until a human reviews the pair, the observed demand is 31 and supply is **18/31 = 58.1%**. After a coordinator explicitly confirms the registration pair belongs to one household, there are **30 distinct pending food needs** and inventory covers **18/30 = exactly 60%**.

### Click-by-click demo

1. **FairShare Lab**: start with the Speed-first vs Fairness-aware comparison. Speed-first serves nearby villages and can leave the Distant Ridge completely uncovered. Fairness-aware distributes stock across villages, showing additional **synthetic travel effort** and improved minimum village coverage. No stock is deducted during preview.
2. **DuplicateShield**: the fictional *Nila Raman* at **Camp East** and *Neela Raman* at **Camp West** share an approximate name, household size, and landmark. Select **Same household** with a human reason. This links records for distribution planning without deleting SOS reports. Selecting **Different households** also works and yields 31 distinct claims, not an assumed 30.
3. **FairShare Lab** again: the capacity indicator now shows **60%**. Select the fairness-aware plan and **Coordinator approve**. This is the only point where the 18 scarce food packs get allocated. Assigned does not mean delivered.
4. **ClaimIntegrity**: one fictional village reports **38 households** although only **13 raw food registrations** appear for it. The system explains this discrepancy but does **not** call it fraud or reject any SOS. Log a coordinator review or corrected *aggregate* estimate.
5. **PriorityGuard**: inspect severe accident bleeding (P1), pregnancy with heavy bleeding (P1), and an older adult lacking essential medication (P2). These are **textual flags for human assessment, not diagnoses**. Age/pregnancy alone does not automatically grant medical priority.
6. **SOS Requests → NeedGraph**: for `rescue-001`, select **Find resources**, **Create proposal**, and approve it with **Human approve**.
7. **FailureShift**: fail the approved boat with an explicit fictional failure cause. A second boat should be proposed; approve the backup on SOS Requests. The failed boat stays unavailable.
8. **ProofLoop**: report simulated delivery, then have a coordinator click **Human verify**. Only after verification does the simulated resolution count increase.
9. **Dashboard**: the initial seed includes **12 earlier fictional outcomes** with corresponding assignment/proof/event records, so the demo already has double-digit verified-demo outcomes. These are *not actual deliveries*. New approvals or reports alone cannot increase that count.
10. **Reset fictional challenge** at the bottom of the dashboard: restores the initial snapshot for another judging run. It first creates a local backup named `data/backup-<timestamp>.json`; do not use it for real personal data.

## Offline demonstration

When the browser cannot reach the backend, the SOS form keeps a **stable submission ID** in the browser's local storage, shows **"SAVED ON THIS DEVICE ONLY — NOT received by coordinators"**, and retries when the backend is reachable. The backend deduplicates repeated deliveries with that submission ID. The service worker caches the HTML/CSS/JS application shell after a successful first visit, but OpenStreetMap base tiles still require internet connectivity. Test offline by opening the page once, stopping the Node server, submitting a **fictional** SOS on the still-open page, restarting Node, then clicking **Retry sync**. Offline local saving **does not notify emergency services**.

Local storage may be cleared by browser privacy settings. This is a demonstration design, not reliable life-critical communication infrastructure.

## Files and modules

- `index.js` — Express server and existing SOS/NeedGraph/FailureShift/ProofLoop APIs, plus new review and allocation endpoints.
- `services/hurdle.js` — deterministic priority flags, candidate duplicates, claims comparison, FairShare allocation proposals.
- `index.html`, `style.css`, `app.js`, `hurdle-ui.js` — polished dashboard and real API interactions.
- `sw.js` — cached app shell only (API responses not cached).
- `data/seed.json` — deterministic fictional reset fixture.
- `data/db.json` — created at first run; ignored by Git. Existing local data isn't overwritten when you restart.
- `tests/hurdle.test.js` — unit tests for scarcity, duplicate review, claims, priorities and allocation.

## Test

```powershell
npm run check
npm test
npm start
```

The original SOS → NeedGraph → Human Approval → FailureShift → Backup Approval → ProofLoop flow remains available. For this version, the 60%-coverage engine allocates **food units only**, and uses provided synthetic distance values, not OpenStreetMap route times. Medical emergencies are flagged for faster **human review** but the algorithm is not a clinical allocation authority.

### Safeguards and limits

- This is a **local demo** bound to `127.0.0.1`. No authentication/authorization, encryption at rest, or tamper-proof audit logs. Human buttons simulate coordinator authority; **never deploy to public internet or use real emergency records as-is**.
- Household duplicate detection is deliberately conservative and explains evidence. Candidate similarities are not probabilities and must not cause automatic denial.
- Reported village claims may be affected by low registration coverage; anomalies trigger investigation, never punishment.
- The synthetic aggregate distance metric shows the cost of geographically fairer allocation; it does not represent a real road network, verified routes, or ETA.
- JSON file writes and browser storage are for one-machine demo only; real deployment needs atomic transactions, privacy safeguards, offline secure sync, identity/roles, and expert evaluation.
- The new project has **not been pushed** to your team's GitHub repository. The connected account had read-only access.

GitHub repository: https://github.com/chiraldew-source/Ai-Agentic
