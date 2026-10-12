# DonorLink usability testing package

Implements Section 9 *Usability Testing of the Working Application* of the IT3060 Milestone 03 report. **Read `final-report.md` first**: it states what was executed, what passed, and what still needs people.

> **Status:** materials ready; credential-free automated checks executed (10/10 pass); app baseline (typecheck, lint, 122 Jest tests) passes. The three workbooks include a **clearly labelled synthetic proxy-evaluation dataset** so their calculations and charts can be demonstrated. **No human participant sessions are recorded in this repository**, and the cross-account walkthrough and native-Android checks have not been run.

## Contents

| Path | What it is |
|---|---|
| `final-report.md` | Report of this package: scope, results, limitations, remaining work |
| `test-plan.md` | Requirements from the PDF, decisions needed, risks, environment, metrics |
| `participant-introduction.md` | Consent script (PDF C.1) and written consent form |
| `participant-protocol.md` | Facilitator procedure, reset checklist, 20-minute timetable |
| `task-scenarios.md` | The six participant cards (T1-T6) |
| `task-success-criteria.md` | Observable success, accepted answers, backend checks per task |
| `questionnaires/` | SEQ, SUS (with scoring), debrief, participant profile |
| `observation-sheet.xlsx` | **Workbook A:** record sessions (Sessions, Observations, SUS) |
| `results-analysis.xlsx` | **Workbook B:** completion, time, SEQ, SUS, Table 16, charts |
| `issue-log.xlsx` | **Workbook C:** issues, Nielsen 0-4 severity scale, candidate issues |
| `test-data/synthetic-data.md` | QA account roles (no credentials) and synthetic records |
| `automation/` | Playwright suite (own `package.json`) |
| `scripts/` | `check-environment.mjs`, `build_workbooks.py` |
| `results/` | Logs of executed checks, `screenshot-register.csv`, `private/` (git-ignored) |
| `screenshots/` | Evidence (see its README) |

## Quick start

Run from the repo root unless stated.

```bash
# 1. Read-only environment check (no secrets printed)
node testing/usability/scripts/check-environment.mjs

# 2. The app's own baseline (unchanged app)
npm run typecheck && npm run lint && npm test -- --ci

# 3. Start the web preview, then run the credential-free Playwright checks
npx expo start --web --port 8081
cd testing/usability/automation && npm install
```

```powershell
# Windows PowerShell: reuse an installed Chromium instead of downloading one
$env:PW_CHROMIUM_PATH = "$env:LOCALAPPDATA\ms-playwright\chromium-1234\chrome-win64\chrome.exe"
npx playwright test public-screens.pw
```

If you let Playwright download its own browser (`npx playwright install chromium`), no `PW_CHROMIUM_PATH` is needed.

### Cross-account functional walkthrough (needs the project owner)

Set the six variables in your own shell (never in a file in the repo), then run:

```powershell
$env:QA_REQUESTER_EMAIL="..."; $env:QA_REQUESTER_PASSWORD="..."
$env:QA_DONOR_EMAIL="...";     $env:QA_DONOR_PASSWORD="..."
$env:QA_REVIEWER_EMAIL="...";  $env:QA_REVIEWER_PASSWORD="..."
npx playwright test qa-e2e.pw
```

It creates one synthetic request, has the reviewer verify it, has the donor accept it, then cancels the request through the UI. It writes screenshots to `screenshots/automated-tests/`. Prefer a **separate Appwrite project** for this (see `test-data/synthetic-data.md`). It was written from the source and has not been run: expect to adjust selectors once.

### Running the participant study

1. `participant-protocol.md` §0: pilot with a team member first (not counted).
2. Per participant: reset checklist → consent → six cards → SEQ after each → SUS → debrief.
3. Enter data in `observation-sheet.xlsx`; log issues in `issue-log.xlsx`.
4. Copy the sheets into `results-analysis.xlsx` as values; read **Summary**, **Task Metrics**, **Table 16**.
5. Regenerate blank workbooks any time: `python testing/usability/scripts/build_workbooks.py` (needs `pip install openpyxl`; this overwrites the three `.xlsx` files).

Workbook formulas have no cached values until opened in Excel/LibreOffice (they calculate on open). They were verified with a formula engine against hand-computed synthetic numbers (not shipped).

## Guardrails

* No credentials, tokens or participant identities anywhere in this folder; `.gitignore` here blocks `.env*`, `*.local`, `results/private/`.
* The existing app was not modified. The specs use the suffix `.pw.ts` so Jest ignores them; the app's `tsc` does type-check them, so keep them type-clean (`npm run typecheck`).
* No deletions or resets of backend data. Test requests are cancelled in the app, never deleted.
* Web-preview results never stand in for Android results.
