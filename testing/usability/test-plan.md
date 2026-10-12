# DonorLink usability testing plan (working application)

Source of truth: *IT3060 HCI Milestones 01-03 Final Report*, Group Y3S2.IT.WE_02, **Section 9 "Usability Testing of the Working Application"**, Table 15, Appendix C (instruments). Where this plan adds anything beyond the report it is marked **[Additional]**.

## 1. Status at a glance

| Item | Status |
|---|---|
| Plan, scripts, questionnaires, workbooks | Prepared |
| Credential-free automated checks (web preview) | **Executed: 10 / 10 passed** |
| App's own typecheck, lint, Jest | **Executed: all pass** (Jest 9 suites, 122 tests) |
| Cross-account functional walkthrough T1-T6 (Playwright) | Written, **not executed** (needs QA credentials typed by the project owner against live Appwrite) |
| Native Android execution | **Not executed** (no APK / development build available in this session) |
| Participant sessions | **Not conducted by this package.** No participant data exists in the repository. |

The report states the sessions "have been completed" and points to a Google Drive folder. This package could not open that folder and does not copy, infer or restate any of its content. Table 16 of the report still reads "See folder". The workbooks are built so that real data from those sessions can be entered and analysed.

## 2. Requirements extracted from the PDF

| # | Requirement | PDF ref | Type | Addressed in |
|---|---|---|---|---|
| R1 | Research questions: RQ1 unaided create/status/respond (NFR01, NFR08); RQ2 prototype issues UI-01..05 resolved; RQ3 SUS satisfaction | 9.1 | Mandatory | §3, results workbook |
| R2 | 5-8 participants; >=2 have donated; >=2 have searched for blood for a family member; regular smartphone users | 9.2 | Mandatory | `Sessions` sheet, Summary recruitment check |
| R3 | Exclude group members; exclude M02 prototype participants where possible | 9.2 | Mandatory | `Sessions` eligibility column |
| R4 | Voluntary participation, verbal or written consent (Appendix C.1); separate screen-recording consent | 9.2, C.1 | Mandatory | `participant-introduction.md` |
| R5 | Pre-created QA accounts, synthetic data only; no real medical, contact or identity data | 9.2 | Mandatory | `test-data/synthetic-data.md` |
| R6 | IDs P01..; anonymous reporting | 9.2 | Mandatory | all instruments |
| R7 | About 20 min, Android phone, DonorLink build, one facilitator + one note-taker | 9.3 | Mandatory (Android: see §6) | `participant-protocol.md` |
| R8 | Think-aloud; scenario cards without step-by-step instructions | 9.3 | Mandatory | protocol, `task-scenarios.md` |
| R9 | Six tasks T1-T6 (Table 15) | 9.3 | Mandatory | `task-scenarios.md`, `task-success-criteria.md` |
| R10 | SEQ after each task, 1 = very difficult, 7 = very easy | C.3 | Mandatory | `questionnaires/seq.md` |
| R11 | SUS, Brooke scoring, 0-100 | 9.3, C.6 | Mandatory | `questionnaires/sus.md`, `SUS` sheet |
| R12 | Short debrief (4 questions) | C.7 | Mandatory | `questionnaires/debrief.md` |
| R13 | Metrics: completion = unaided / attempting; time from end of reading scenario to success state; errors, recoveries, assists, abandoned as defined in C.3 | 9.3, C.3 | Mandatory | `Observations` + `Task Metrics` |
| R14 | Assist after 60 s stuck or asked twice (one neutral hint); abandoned if given up or > 3 min | C.3 | Mandatory | protocol |
| R15 | Severity on Nielsen's 0-4 scale; report counts (e.g. 4/5) with small-sample caveat | 9.3 | Mandatory | `issue-log.xlsx` |
| R16 | Evidence: consent records, recording sheets, SUS forms, consented recordings, set-up photos without faces | C.8 | Mandatory | protocol, `results/` |
| R17 | Facilitator preparation: one verified pending request for T3, one alert ready for T5 | C.3 | Mandatory | protocol §Before each session |
| R18 | Table 16 summary (completed unaided n/N, mean time, errors, assists, mean SEQ, SUS mean + range) | 9.4 | Mandatory | `Table 16` sheet |
| R19 | Issues UI-01..05 each tied to a task (T4, T3, T6, T5, T3) | 10.1 | Mandatory | `Issues` sheet column "Related prototype issue" |
| A1 | Playwright functional checks of the web preview | n/a | **[Additional]** | `automation/` |
| A2 | Screenshot register and evidence folders | prompt | **[Additional]** | `results/screenshot-register.csv` |
| A3 | Code-inspection candidate issues (CAND-nn) | n/a | **[Additional]**, unverified | `issue-log.xlsx` |

## 3. Points in the PDF that need a decision (found while reading it)

| # | Observation | How this package handles it |
|---|---|---|
| D1 | Section 9.3 says "**five** scenario tasks", but Table 15 and Appendix C.4 list **six** (T1-T6). | Six tasks are implemented, as in Table 15 and as requested. The report text should be corrected to "six". |
| D2 | The SEQ scale is given only in Appendix C.3 (1-7), not in Section 9. | 1-7 used. |
| D3 | Completion rate in the PDF is *unaided / attempting*. A general definition would be *completed / attempted*. | Both shown: unaided rate (PDF) and assisted rate separately; total completion also given. Application-blocked attempts are never counted as completed. |
| D4 | Severity: PDF uses Nielsen 0-4. | 0-4 is stored; the sheet also labels each level Low / Medium / High. |
| D5 | Section 9 says the sessions were conducted; Table 16 has no numbers; Appendix D says device tests were not run; section 8.2 says no Android device was available. | Treated as unverified. Nothing is copied from the shared folder. |
| D6 | The report cites 21 suites / 384 tests / `.maestro` flows on branch `development`; this checkout (`Testing`, commit `96e9dab`) has 9 Jest suites / 122 tests and no `.maestro` folder. | Actual counts reported. The report's figures cannot be reproduced from this branch. |
| D7 | T3 says "how many donors have **responded**", but the app shows "N of M donors **accepted**" plus Contacted / Accepted / Waiting / Declined. | Accepted answer defined in `task-success-criteria.md`; logged as CAND-03. |
| D8 | T4 says "until **6 pm**". The app rejects an end time that is not in the future, and the web preview has no clock-time picker. | Sessions must start before 18:00 (or the card time is changed and recorded); T4 needs Android. Logged as CAND-01, CAND-02. |
| D9 | C.3 says prepare "one verified pending request (for T3)". A request cannot be both verified and pending verification. | Interpreted as: the facilitator verifies the participant's T2 request (reviewer account) before T3 and records the true state as ground truth. |

## 4. Application state (read from the repository)

* **Stack:** Expo SDK `~57.0.26`, React Native `0.86.3`, React 19.2.3, Expo Router (`src/app`), NativeWind 5 rc, gluestack-ui. Backend: **Appwrite Cloud** (auth, TablesDB, storage, realtime, one server Function `donorlink-api`). No `ios/` or `android/` folder (CNG).
* **Branch / commit:** `Testing` @ `96e9dab`, working tree clean at start.
* **Screens used by the tasks:** `(auth)/login`, `(app)/(tabs)/index` (Home), `requests/create` → `requests/review` → `requests/matching`, `requests/[id]` (RequestDetailsScreen), `requests/tracking`, `donor/availability`, `donor/incoming/[id]`, `(tabs)/notifications` (Alerts), `history/index`.
* **Request lifecycle:** submitted → `pending_verification` ("Awaiting verification") → verified → matching → donors_contacted → partially_fulfilled → fulfilled → completed (also cancelled / rejected / expired). A request must be verified before donors are contacted.
* **Roles:** Appwrite labels (`admin`, `organization`) set only by the server. A single account can be both requester and donor, but matching never offers a request to its own requester.
* **Existing tests:** Jest (`jest-expo`): `src/domain/__tests__` (3) and `appwrite/functions/api/__tests__` (6 files + helpers). No component tests in this branch.

## 5. Risks and safeguards

| Risk | Safeguard |
|---|---|
| Shared live backend: test records pollute real data | Only the three QA accounts; every request carries hospital `ZZ USABILITY TEST HOSPITAL` and the note "USABILITY TEST"; each run cancels its own request through the UI. **No deletions, no resets, no direct database writes.** |
| Credentials leaking into the repo | None stored anywhere. E2E reads `QA_*` environment variables at run time; `.gitignore` in `testing/usability` blocks `.env*`, `*.local`, `results/private/`. The provisioning API key in `.env.provision.local` is **not** used. |
| The new folder affecting the app | `testing/` is only new files. Automation lives in its own `package.json`. Specs use the suffix `.pw.ts` so Jest ignores them. The app's root `tsc` does type-check these files (tsconfig includes `**/*.ts`), so they must stay type-clean. `npm run typecheck`, `lint`, `test` re-run after the changes: all pass. `git diff` on tracked files is empty. |
| Participant identification | IDs P01..; no names, phone numbers, faces; recording only with separate consent. |
| Learning effect | Exclude M02 prototype participants where possible; flagged in the workbook. |
| Web ≠ Android | Web preview results are labelled as such and never used to claim Android behaviour (see §6). |
| Async fan-out makes T5 flaky | Pilot run before real sessions; verify the alert exists before handing over the phone. |

Not done on purpose: no account creation, no sign-in to the live backend by the assistant, no use of the admin API key, no schema or permission changes.

## 6. Test environment

| Environment | Use | Limits |
|---|---|---|
| **Android phone running the DonorLink build** | **Required by the PDF** for participant sessions | No build was available here. The report's EAS APK (`e6142dd1`, commit `1de36d6`) predates the final commit and expires 21 Oct 2026. Rebuild: `npx eas-cli build -p android --profile preview` (needs the owner's EAS login). |
| Android emulator | Dry runs only | An AVD `Medium_Phone` exists on this machine; `adb` is not on `PATH`; needs a development build. |
| **Expo web preview** (`expo-web`, 390 × 844, Chromium) | Used for the automated functional checks | No keychain, no native date/time dialogs, no Android back button, no TalkBack, no touch gestures. `Pick date & time` is hidden on web, so T4 as worded cannot be completed there. |

Recorded for the automated run: Windows 11, Node v24.19.0, Playwright 1.64.0 driving the pre-installed Chromium 151.0.7922.34, viewport 390 × 844, app at commit `96e9dab`, Appwrite Cloud via the existing `.env` (values not recorded). Every session record must note device, OS, build/commit, and environment (`Sessions` sheet).

## 7. Participants

* 5-8 participants. At least two who have donated blood and at least two who have searched for blood for a family member (one person can be both). All regular smartphone users.
* Exclude the four group members and, where possible, the five students of the 18 Sept 2026 Figma test (they carry a learning effect).
* Recruit outside the project team; do not coach beforehand; do not tell them the task list.
* Record only: age band, smartphone frequency, donated (Y/N), searched (Y/N), used M02 prototype (Y/N), consent, recording consent.
* No participant is invented here. If fewer than five usable sessions exist, report that the PDF's minimum is not met.

## 8. Session design (about 20 minutes)

| Min | Step | Owner |
|---|---|---|
| 0-3 | Welcome, consent script (C.1), recording consent, think-aloud explanation | Facilitator |
| 3-14 | Six task cards, one at a time; SEQ after each (max 3 min per task) | Facilitator reads; note-taker times and counts |
| 14-17 | SUS (10 items, paper or form) | Participant |
| 17-20 | Debrief (4 questions), thanks, reset checklist | Facilitator |

Full procedure with scripts: `participant-protocol.md`.

## 9. Tasks

Six tasks exactly as in Table 15; participant wording is on cards in `task-scenarios.md`; observable success criteria, accepted answers, data preconditions and backend checks are in `task-success-criteria.md`.

## 10. Metrics and how they are calculated

| Metric | Definition | Where |
|---|---|---|
| Completion (PDF) | participants completing **unaided** ÷ participants **attempting** | `Task Metrics` col H |
| Assisted completion | completed after one neutral hint ÷ attempting | col I |
| Total completion | (unaided + assisted) ÷ attempting | col J |
| Abandoned / blocked | counts; blocked = a defect stopped the task, kept in the denominator, never "completed" | cols F, G |
| Time on task | seconds from end of reading the scenario to the success state; mean over completed attempts only (unaided, and all completed) | cols M, N |
| Errors / recoveries / assists | per PDF C.3 | cols O-Q |
| SEQ | mean of valid 1-7 responses per task | col R |
| SUS | odd: score−1; even: 5−score; sum × 2.5 | `SUS` sheet |
| Severity | Nielsen 0-4 (+ Low/Medium/High label) | `issue-log.xlsx` |

Report counts (e.g. 4/6) and the small-sample caveat, never percentages alone.

## 11. Automation strategy

| Layer | Tool | Purpose | Status |
|---|---|---|---|
| App unit/API tests | Existing Jest | Regression baseline of domain rules and Function handlers | Run: 9 suites, 122 tests pass |
| Typecheck, lint | existing `tsc`, `expo lint` | Baseline | Run: pass |
| Signed-out screens | **Playwright** on web preview (`public-screens.pw.ts`) | Welcome, login validation, register/forgot reachable, route guard | **Run: 10/10 pass** |
| Cross-account walkthrough | Playwright (`qa-e2e.pw.ts`) | requester → reviewer → donor flow mirroring T1-T6 | Written, skipped without credentials |
| Android UI automation | Maestro / Appium | Would be the right tool for native | Not installed; not chosen now (no build, no device) |
| React Native Testing Library | already a devDependency | Component tests | No new tests added; would require touching app config |

Automated checks are **functional**, not usability. They know where every button is. They cannot say whether a first-time user finds it.

## 12. Evidence policy

Screenshots go under `screenshots/` (`application/`, `automated-tests/`, `task-evidence/`, `issues/`, `annotated/`), are never edited (annotated copies go in `annotated/`), show synthetic data only, and are listed in `results/screenshot-register.csv`. Participant-session screenshots require consent and are named `Pnn_Tn_description.png`. A screenshot that could not be taken is documented as a limitation, not replaced.

## 13. Deliverables map

| File | Purpose |
|---|---|
| `README.md` | How to run everything |
| `participant-introduction.md` | Briefing and consent text |
| `participant-protocol.md` | Facilitator procedure |
| `task-scenarios.md` | Participant cards |
| `task-success-criteria.md` | Observable criteria and backend checks |
| `questionnaires/` | SEQ, SUS, debrief, participant profile |
| `observation-sheet.xlsx` | Data entry (Workbook A) |
| `results-analysis.xlsx` | Metrics, SUS, charts, Table 16 (Workbook B) |
| `issue-log.xlsx` | Issues + severity scale (Workbook C) |
| `test-data/synthetic-data.md` | Accounts (roles only), synthetic records |
| `automation/` | Playwright suite |
| `scripts/` | Environment check, workbook generator |
| `results/` | Logs, screenshot register, per-session output |
| `final-report.md` | Report of what was and was not done |
