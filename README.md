# BellaNova — Two-Laptop SOS + Human Coordinator (SIMULATION)

**This is a fictional, human-supervised hackathon prototype. It does not dispatch real emergency services or independently verify delivery.**

## Setup on YOUR coordinator laptop only (Windows)

1. Extract this ZIP, open the inner `lifecrisis-fairshare` folder in VS Code (the folder containing `package.json`).
2. Stop any old server running on port 3001 using `Ctrl+C`.
3. Open **Terminal → New Terminal** and run:
   ```powershell
   npm install
   npm run start:lan
   ```
4. On that coordinator laptop, open **http://localhost:3001/coordinator.html**.
5. Connect BOTH laptops to the same **trusted private Wi-Fi/hotspot**. Use `ipconfig` to find the coordinator laptop's IPv4 address (for example `172.20.10.8`; it may change).
6. On the teammate's laptop, stop its old server if it has one. Open **http://YOUR-COORDINATOR-IP:3001/sos-signal.html** in a browser. Do **not** use `localhost` or a separate Node server on the SOS laptop.

The sender may also open `/` on your coordinator's private IP; it redirects to the SOS page.

## What you see

**Both screens share EXACTLY FOUR Live Overview counters:** SOS Requests, Critical Priority, Pending Approval, Resolved Cases.

**Teammate:** SOS Requests → fill Name, Area, Location (manual or GPS), Help Type (Food / Water, Rescue Operation, Medicine, Shelter, Other), optional Description → **SEND SOS**. The sender can view its updated request history, SilentZone field-check status and **read-only FairShare**.

**Coordinator:** Priority Queue → choose P1–P4 → **CONFIRM PRIORITY** → Assignment & Approval → choose a compatible resource and available trained team → **YES — APPROVE** (or **NO — REJECT**) → ProofLoop Closure → **YES — RESOLVED** (or **NO — NOT YET**). YES marks the simulated case closed immediately with automatic time-based audit data; no proof note/document is required. It does **not** verify actual physical delivery. Resolved Cases increments once only, and both dashboards update.

**FairShare (both screens):** See the same live resource supply, demand, shortage, village-level distribution and Speed-First / Fairness-Aware comparison. **Only the coordinator** can approve a plan. Approving it reserves the matching food resources and sends updates to both screens; **it does not close SOS cases**. Only a subsequent coordinator YES — RESOLVED closes a case. FairShare previews require manually submitted Food / Water requests. The original FairShare comparison logic remains under `services/hurdle.js`.

**SilentZone:** The coordinator can assign a fictional field check and record its completion. This simulates an offline-area visit, not satellite or actual disconnected communication.

## Important details

- On first run, SOS records start empty. The original sample fixture is preserved separately as `data/seed.json` but is **not automatically loaded**. The active local DB is `data/db.json` generated from `data/initial.json`.
- If you already have a `data/db.json`, it is preserved on restart. To start fresh, **back it up first**, stop the server, then remove only `data/db.json` in this newly extracted project folder.
- Both laptops must connect to the **one coordinator server**, not two separate backends. Sync uses server-sent events and a 3.5-second polling fallback. Refresh if needed.
- GPS geolocation in modern browsers usually requires HTTPS or localhost. On the SOS teammate's LAN HTTP address, GPS may be blocked; use **Enter Location Manually** instead. No GPS coordinates are fabricated.
- Coordinator-changing endpoints are restricted to requests originating from the **host computer (localhost)** in this LAN demo. Do not forward port 3001 to the internet or use public Wi-Fi. This is not production authentication.
- SOS list and FairShare allocations are stored as shared backend records. The four counters are computed from those same records. No dashboard values are hardcoded.
- Existing original `index.html`, `app.js`, `style.css`, `hurdle-ui.js` and original Express endpoints remain in the project for compatibility; `/` shows the simplified SOS interface. No React or new framework.

## Tests

```powershell
npm test
npm run check
```

The automated tests cover state transitions, counter synchronization through a single backend, idempotent SOS submission and resolution, shared FairShare approval, stock reservations, and SilentZone. **An actual two-laptop Wi-Fi run still needs to be tested locally.**
