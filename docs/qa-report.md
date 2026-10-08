# DonorLink QA Test Report

**Audit date:** 2026-10-09 · **Branch:** `Testing` (base commit `00b3894`) · **Auditor:** QA audit with Claude Code
**Test case matrix:** [qa-test-matrix.md](qa-test-matrix.md) (all TC-IDs with preconditions, steps, data, expected/actual, status, severity and evidence)
**Supersedes:** the 2026-10-07/08 report (full text kept in git history: `git show 00b3894:docs/qa-report.md`). Its defects are summarised in §20.2.

Evidence labels used throughout:

| Label | Meaning |
| --- | --- |
| **AUTOMATED** | Executed by Jest in this audit; the test is in the repository |
| **AUTOMATED (mock backend)** | Executed against the real function handlers on the in-memory Appwrite stand-in (`appwrite/functions/api/__tests__/helpers/fakeBackend.js`). Proves server logic, **not** live Appwrite permissions |
| **STATICALLY VERIFIED** | Concluded from reading source/config only |
| **LIVE BACKEND VERIFIED** | Observed on the real Appwrite project. Nothing was live-verified in *this* audit; items carried over from 2026-10-07 are marked as such |
| **MANUAL / NOT EXECUTED** | Needs a person, device or credentials; not run |
| **BLOCKED** | Could not be run from this environment (reason given) |

---

## 1. Executive Summary

DonorLink's architecture is sound for its purpose. All privileged writes go through one Appwrite Function that derives identity from Appwrite's execution context, re-validates input with the same shared domain rules the app uses, and enforces one transition table. Automated cross-tenant (IDOR) probes against that function found **no broken access control in the HTTP paths**: organization A cannot touch organization B's inventory, members, profile or requests; donors cannot confirm their own donations; strangers cannot cancel, complete, verify or answer other people's requests; payload IDs and role claims are ignored.

The audit did find **12 confirmed defects** (0 critical, 1 high, 7 medium, 4 low). Each was reproduced by a failing test before it was fixed, and each now passes with a regression test. Most are **concurrency and idempotency** gaps (simultaneous confirmations, double taps, retry during an in-flight call), plus lifecycle edge cases (expiry, re-reviewing an organization) and one **shared-device privacy** issue (an unsent request draft survived sign-out into the next account).

| | Baseline (before audit) | Final |
| --- | --- | --- |
| Test suites | 14 passed / 14 | **21 passed / 21** |
| Tests | 206 passed / 206 | **384 passed / 384** (0 failed, 0 skipped) |
| `npm run typecheck` | pass | pass |
| `npm run lint` | pass | pass |
| Line coverage, all source files (honest denominator) | not measured (default report showed 77.9 % of *imported* files only, including test helpers) | **50.1 %** |
| Backend function line coverage | n/a | **81–92 %** (handlers 88.5 %) |
| Domain rules line coverage | n/a | **97.5 %** |

**Important limits:**

1. The server fixes are **not deployed**. The live Appwrite function still runs the old code until someone runs `npm run appwrite:provision` (§25).
2. No real Android device, emulator or live signed-in session was used, so every device, E2E and live-permission check in this report is **NOT EXECUTED**.
3. Organization, admin and onboarding screens have **no component tests** (0 % coverage). Their server actions are well tested.

**Recommendation (§25):** **RELEASE READY WITH MINOR ISSUES** for the university HCI demonstration, *conditional on* redeploying the function and running the Android smoke checklist (§19). Not ready for a public production release.

## 2. Test Environment

| Item | Value |
| --- | --- |
| OS | Windows 11 Pro 10.0.26300 |
| Node / npm | v24.19.0 / 11.17.0 (CI uses Node 22) |
| Expo / RN / React | SDK 57 (`expo ~57.0.26`), React Native 0.86.3, React 19.2.3, Expo Router ~57.0.24 |
| Test stack | Jest ~29.7 + `jest-expo` ~57.0.5, `@testing-library/react-native` ^13.3.3, `expo-router/testing-library` (route-guard tests) |
| Backend under test | `appwrite/functions/api` (node-appwrite ^29) on the in-memory fake |
| Live Appwrite | Project `6ac4b77b003a7479e081` (sgp). **Not accessed in this audit** |
| Devices | **None.** No emulator or physical device was available |
| `npm install` | Succeeded. Reports 69 vulnerabilities (16 moderate, 53 high) in the dependency tree, not triaged (see OBS-04). `package-lock.json` unchanged |

Configuration change made for testing: `package.json` → `jest.transformIgnorePatterns` now also transforms `standard-navigation`, an ESM-only dependency of Expo Router 57. Without it the real router cannot load under Jest, which is likely why no earlier test exercised the real route guards.

## 3. Application Architecture

Verified by reading the code (STATICALLY VERIFIED), consistent with `docs/architecture.md`:

- **Routes** (`src/app`, Expo Router). Root `_layout.tsx` uses `Stack.Protected`:
  - `(auth)`: signed out, or verifying email → welcome, login, register, forgot-password, verify-email
  - `(onboarding)`: profile incomplete → 7 steps
  - `(app)`: tabs Home/Requests/Alerts/Profile, plus requests/*, donor/*, history/*, hospitals/*, settings/*, verification/*, support
  - `(organization)/org/*`: needs an `organization` / `orgm<id>` label
  - `(admin)/admin/*`: needs the `admin` label
  - `gallery`: `__DEV__` only
  - 72 route files in total
- **Roles:** Appwrite user labels (`admin`, `organization`, `orgm<orgId>`), writable only with a server key.
- **Reads:** the client reads Appwrite TablesDB directly, guarded by row permissions.
- **Writes:** `callApi()` → function `donorlink-api`, which exposes 33 actions.
- **13 tables:**
  - profiles, donor_profiles, blood_requests, request_responses, donations
  - organizations, organization_members, blood_inventory
  - notifications, verifications, audit_logs, support_tickets, system_settings
- **Bucket:** one private `files` bucket.
- **State machines:** request (12 states), response (6), donation (4), all in `src/domain/transitions.ts`. The same TypeScript rules are transpiled into the function bundle.
- **Concurrency primitives:**
  - Atomic `incrementRowColumn`/`decrementRowColumn` with `max`/`min`
  - Unique indexes (`donations.responseId`, `request_responses(requestId, donorId)`)
  - Client-generated idempotency keys for request creation
  - New in this audit: fixed-ID audit rows as once-only claims (§14)

## 4. QA Strategy

Risk-based. The function is the security boundary, so most new tests target it directly:

1. **Baseline:** install, typecheck, lint, test, coverage recorded before any change (§6).
2. **Static review:** every function handler, every domain module, the client data layer (api, auth, errors, useResource, providers, services), route layouts and the key screens; pattern scans for TODO/`any`/unsafe casts/swallowed errors/logging/secrets.
3. **Reproduce first:** each suspected defect became a test with the *correct* expectation. It was run against the unmodified code, and only fixed if it failed. 21 new tests failed on the original code (§20).
4. **Minimal fixes**, then the full suite (§21).
5. **Honest coverage** with an explicit `collectCoverageFrom` denominator (§22).

## 5. Requirements Traceability

**FR01–FR10 / NFR01–NFR08: NOT VERIFIABLE FROM REPOSITORY.** The repository has no numbered requirements list (searched all files for `FR`/`NFR`/"functional requirement"). So that nothing is invented, the matrix below traces the **documented capabilities** instead: the `README.md` Features table, `docs/architecture.md` security model, and the Milestone 02 usability findings UI-01…UI-05 in `docs/implementation-plan.md`. Map these to your official FR/NFR numbers if your coursework has them.

### 5.1 Functional capabilities

| Ref | Documented capability (source) | Implementation | Tests (type) | Status | Gaps / defects |
| --- | --- | --- | --- | --- | --- |
| F-01 | Sign up with email-code verification, sign in, reset password (README) | `src/app/(auth)/*`, `lib/appwrite/auth.ts`, `providers/AuthProvider.tsx` | `fixes/authFlow`, `fixes/sessionFallback`, `qa/screensQa` TC-AUTH-001..003, `qa/authProvider` TC-AUTH-030..032 (AUTOMATED, mocked Appwrite) | PASS (mocked) | forgot-password & verify-email screens untested; live email OTP NOT EXECUTED |
| F-02 | Guided onboarding (README) | `src/app/(onboarding)/*`, `OnboardingContext` | server `profile.save` covered (mock backend); route guard TC-AUTH-012 | PARTIAL | 0 % screen coverage; NOT EXECUTED on device |
| F-03 | Role-based navigation / protected areas (architecture) | `src/app/_layout.tsx`, `(auth)/_layout.tsx` | `qa/routeGuards` TC-AUTH-010..017 with the **real router** (AUTOMATED) | PASS | Guards are UX only; authz verified separately (F-10) |
| F-04 | Emergency request → review → submit (README) | `requests/create`, `review`, `RequestDraftContext`, `request.create` | smoke tests, `qa/clientFlows` TC-PATIENT-010..013, `qaAudit` TC-REQ-007, TC-CON-001/002 | PASS after fixes | **DL-QA-004, -009, -011 fixed** |
| F-05 | Verification of requests by hospital/admin (README, architecture) | `request.verify`, `canVerifyRequest` | `securityAndOrganizations`, `qaAudit` TC-SEC-003, TC-REQ-006, TC-VER-002 | PASS after fix | **DL-QA-008 fixed** (de-verified org could still verify) |
| F-06 | Donor matching & ranking (architecture §Matching) | `domain/matching.ts`, `request.matches`, `startMatching` | `matching.test`, `qaBoundaries` (64-pair compatibility table), lifecycle tests | PASS | Clinical correctness is out of scope by design (disclaimer) |
| F-07 | Donor availability, accept/decline with confirmation (README, UI-01, UI-05) | `donor/availability`, `donor/incoming/[id]`, `response.*` | smoke tests, `qa/screensQa` TC-DONOR-010..012, `qaAudit` TC-REQ-002/003, TC-CON-003/005, `concurrencyAndHardening` | PASS after fixes | **DL-QA-005, -007, -010 fixed** |
| F-08 | Donation coordination & confirmation, request completion (README) | `donation.*`, `request.complete` | `qaAudit` TC-REQ-004/005, TC-CON-004/007, TC-SEC-006 | PASS after fixes | **DL-QA-002, -003 fixed**; `donor/donation/[id]` screen untested |
| F-09 | Live tracking, notifications, history (README, UI-03) | `RequestDetailsScreen`, `tracking`, `NotificationsProvider`, `history/*` | `workflow.test` (timeline), `qa/screensQa` TC-NOTIF-001..003, smoke | PARTIAL | Tracking/history screens 0 %; Realtime NOT EXECUTED live; **DL-QA-006 fixed** |
| F-10 | Organizations: verify requests, inventory, team (README) | `(organization)/org/*`, `org.*`, `verification.*` | `securityAndOrganizations`, `qaAudit` TC-SEC-001..005, TC-VER-001/002 (mock backend) | Server PASS after fix; UI untested | **DL-QA-008 fixed**; 0 % org screen coverage |
| F-11 | Admin: users, verification, orgs, analytics, audit, support, settings (README) | `(admin)/admin/*`, `admin.*`, `support.*` | `securityAndOrganizations`, `qaAudit` TC-SEC-005/011 (mock backend) | Server PASS; UI untested | 0 % admin screen coverage |
| F-12 | Request expiry by scheduled maintenance (architecture) | `maintenance.run`, `main.js` | `entrypoint.test`, lifecycle, `qaAudit` TC-REQ-003/008, TC-SEC-010 | PASS after fixes | **DL-QA-001, -005, -006 fixed**; live schedule verified 2026-10-07 (old code) |

### 5.2 Non-functional qualities

| Ref | Quality (source) | Evidence | Status | Gaps |
| --- | --- | --- | --- | --- |
| N-01 | Server-side authorization; never trust client IDs/roles (architecture §Security) | `qaAudit` TC-SEC-001..011, `securityAndOrganizations` (AUTOMATED, mock backend) | PASS | Live row permissions not re-checked this audit (BLOCKED, §11) |
| N-02 | Validation twice, same rules client and server | shared `src/domain`; `qaBoundaries` schema-size tests | PASS after **DL-QA-009/-010** | — |
| N-03 | Privacy: coarse location, no phone/address exposure, private files | `matching` sanitised output tests, `fixes/uploads`, `qa/clientFlows` TC-PATIENT-010, `qa/authProvider` TC-AUTH-031 | PASS after **DL-QA-011** | Device keychain storage NOT EXECUTED |
| N-04 | Idempotency / no duplicate records | TC-CON-001..007, `concurrencyAndHardening` | PASS after fixes | Status-history interleaving residual (DL-QA-013) |
| N-05 | Error, loading, offline states with retry | `qa/screensQa` TC-NET-010, `qa/authProvider` TC-NET-020, `qaAudit` TC-NET-001/002, smoke empty states | PASS (mocked) | Real offline/slow network NOT EXECUTED |
| N-06 | Accessibility (labels, roles, contrast, targets) | `consistency` + `qa/contrast` (27 contrast pairs), static label scan (22/22 pressables) | PASS after **DL-QA-012** | Screen reader & large-font NOT EXECUTED; DL-QA-015 open |
| N-07 | Consistent navigation (UI-04) | four fixed tabs, single header component (STATICALLY VERIFIED), route guard tests | PASS | Android back button NOT EXECUTED |
| N-08 | Performance | static review §18 | NOT TESTED dynamically | No virtualised lists; capped queries |

## 6. Automated Test Results

### 6.1 Baseline (unmodified code, 2026-10-09)

| Command | Result |
| --- | --- |
| `npm install` | OK; 69 audit findings (16 moderate, 53 high); 2 install-script warnings (`@tailwindcss/oxide`, `unrs-resolver`) |
| `npm run typecheck` | PASS, 0 errors |
| `npm run lint` | PASS, 0 problems |
| `npm test` | **14/14 suites, 206/206 tests passed**, 0 skipped. Warnings: React `act(...)` notices for `Icon` state updates in screen tests (test noise, not app errors) |
| `npx jest --coverage` (default config) | Statements 72.99 %, Branches 62 %, Functions 63.12 %, Lines 77.89 %. **Misleading:** only files imported by some test are counted, and the fake backend test helper is included |

### 6.2 Final

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 problems) |
| `npm test` | **21/21 suites, 384/384 passed**, 0 failed, 0 skipped |
| Coverage, all source files | Statements 47.18 % (2303/4881), Branches 44.0 % (1824/4145), Functions 31.47 % (429/1363), **Lines 50.08 % (2087/4167)** |

### 6.3 New test files (this audit)

| File | Tests | Scope |
| --- | --- | --- |
| `appwrite/functions/api/__tests__/qaAudit.test.js` | 30 | IDOR, wrong-role, lifecycle via API, concurrency, idempotency, malformed input |
| `src/domain/__tests__/qaBoundaries.test.ts` | 103 | 8×8 compatibility table, invalid transitions, unit/time/radius boundaries, schema-size limits, inventory/geo edges |
| `src/__tests__/qa/routeGuards.test.tsx` | 12 | Real root + auth layouts with the real Expo Router |
| `src/__tests__/qa/clientFlows.test.tsx` | 4 | Shared-device draft privacy, double-submit, retry, duplicate banner |
| `src/__tests__/qa/screensQa.test.tsx` | 10 | Register, incoming request failures, notification open |
| `src/__tests__/qa/authProvider.test.tsx` | 4 | Session restore, sign-out clean-up, offline boot |
| `src/__tests__/qa/contrast.test.ts` | 15 | WCAG contrast for pairs not covered before |
| **Total new** | **178** | |

## 7. Unit Testing

All AUTOMATED. Domain line coverage is 97.5 %.

- **Blood groups:** all 64 donor→recipient pairs are checked against an independently written ABO/Rh rule; O− is the universal donor and AB+ the universal recipient (`qaBoundaries`).
- **Transitions:** invalid moves are rejected, e.g. cancelled→matching, expired→matching, completed→matching, fulfilled→pending_verification, rejected→verified, pending_verification→matching (skips verification), submitted→donors_contacted, fulfilled→expired. No self-transitions; final response/donation states; accepted→accepted refused.
- **Units:** 1 and 20 accepted. 0, 21, −1, 1.5, NaN, ∞, null and undefined rejected (domain), and `"2"` (string) rejected at the API.
- **Time:** required-by is accepted up to 30 days ahead and with 5 minutes of clock skew, rejected beyond either, and malformed dates are rejected. Whitespace-only fields count as missing.
- **Availability:** radius 1 and 100 km inclusive, 0.5 and 101 rejected; temporarily-unavailable donors are excluded from matching; stale or lapsed availability counts as unknown (existing tests).
- **Inventory:** 0 free units → "out"; reserved = available → "out"; >100 000 rejected.
- **Geo:** zero distance for the same point, symmetric distance, out-of-range coordinates rejected.
- **Schema-size consistency (new):** every optional free-text field the validators accept must fit its Appwrite column. **This failed on 7 fields → DL-QA-009.**

## 8. Component Testing

AUTOMATED with React Native Testing Library and mocked services.

| Area | Covered | Not covered |
| --- | --- | --- |
| Auth | Welcome, Login (smoke); Register: empty fields, weak and mismatched passwords, double tap → one sign-up, server error shown, form reusable (TC-AUTH-001..003); auth layout redirects (existing) | Forgot password, verify-email screen |
| Patient | Home, Requests tab (incl. empty state), Create (validation), Review: double tap → one submit, retry reuses the client id, duplicate banner → "Open my requests"; Matching empty state | Request details, tracking, history screens, donor details |
| Donor | Availability form, Incoming: confirm-before-accept, decline reason, accept failure → toast + reload and no false success, closed request not answerable, not-invited empty state, network error → retry | Donation coordination screen |
| Notifications | List & categories (smoke); open → mark read once + navigate, already-read → no server call, mark-read failure still navigates | Mark-all-read UI |
| Organization | — | **All screens (0 %)** |
| Admin | — | **All screens (0 %)** |
| Onboarding | — | **All 7 steps (0 %)** |

## 9. Integration Testing

- **Route guards with the real router** (`qa/routeGuards`, AUTOMATED). This renders the real `src/app/_layout.tsx` and `(auth)/_layout.tsx` through `expo-router/testing-library`, with stub leaf screens. Full results in §12.
- **End-to-end server lifecycle** on the mock backend (existing `requestLifecycle` plus `qaAudit`): create → verify → match → accept/decline → confirm → complete, cancel cascade, expiry, withdraw, no-show.
- `consistency.test.ts` (existing): schema enums match the domain, and every client `callApi` action exists in the function.

## 10. Backend / API Testing

AUTOMATED (mock backend). All 33 registered actions were driven with 10 malformed payloads each, as both a regular user and an admin (660 calls):

- null, string, number, boolean
- `[]` and `['x']`
- `{requestId:{}}`, `{requestId:['a']}`, `{donationId:5}`, `{notificationId:null}`

**No 500s** (TC-NET-001). Nested malformed fields return 400 (TC-NET-002), after DL-QA-010.

| Action group | Valid | Invalid / boundary | Unauthorized / wrong role | Cross-user | Missing entity | Repeat / concurrent |
| --- | --- | --- | --- | --- | --- | --- |
| `request.create` | ✓ | ✓ units, district, time, length | ✓ maintenance mode | ✓ foreign client id → 403 | ✓ unknown hospital → 400 | ✓ retry → duplicate; **concurrent same id fixed (DL-QA-004)**; near-duplicate 409 |
| `request.verify` | ✓ | ✓ reject needs note | ✓ requester/stranger 403 | ✓ org A on org B 403 | ✓ | ✓ second review 409; **de-verified org fixed (DL-QA-008)** |
| `request.matches` / `contactDonor` | ✓ | ✓ radius clamp | ✓ stranger, donor 403 | ✓ | ✓ | ✓ already contacted 409 |
| `request.cancel` / `complete` | ✓ | ✓ terminal states 409 | ✓ stranger/donor 403 | ✓ | ✓ | ✓ |
| `response.accept` / `decline` / `withdraw` | ✓ | ✓ declined→accept 409; **expired-by-time fixed (DL-QA-005)** | ✓ uninvited 404 | ✓ | ✓ | ✓ concurrent accepts never over-fill; **double decline fixed (DL-QA-007)** |
| `donation.confirm` / `schedule` / `cancel` | ✓ | ✓ final states 409; past time 400 | ✓ donor-self & stranger 403 | ✓ | ✓ | **concurrent confirms fixed (DL-QA-002, -003)** |
| `verification.submit` / `review` | ✓ | ✓ 1–3 docs, foreign/missing files | ✓ non-admin review 403 | ✓ | ✓ | ✓ pending duplicate 409; **re-review fixed (DL-QA-008)** |
| `org.*` | ✓ | ✓ inventory counts | ✓ staff vs admin, unverified org | ✓ org A ↔ org B all 403 | ✓ | ✓ last-admin protection |
| `admin.*`, `support.reply`, `maintenance.run` | ✓ | ✓ settings ranges | ✓ user, donor, org member 403 | n/a | ✓ | ✓ self-demotion/disable 409 |
| `notifications.markRead` / `markAllRead` | ✓ | ✓ | ✓ | ✓ foreign → 404 | ✓ | ✓ double mark-read harmless |
| Scheduled trigger | ✓ maintenance | — | **userless non-maintenance actions fixed (DL-QA-001)** | — | — | — |

## 11. Security Testing

| ID | Check | Result | Evidence |
| --- | --- | --- | --- |
| SEC-A | Secrets in the repository | **PASS.** `git ls-files` has no `.env*` except `.env.example`. `.env` was tracked in 3 old commits (`902eb99`, `8a5dc98`, `3f0e300`) but held only `EXPO_PUBLIC_*` identifiers (endpoint, project, platform, database and function IDs), which ship in the app by design. No API key was ever committed | STATICALLY VERIFIED (git history inspected, values redacted) |
| SEC-B | Local provisioning key | `.env.provision.local` exists locally with `APPWRITE_API_KEY`, git-ignored and never committed. **Whether that key is still active in Appwrite: NOT VERIFIABLE FROM REPOSITORY.** The setup guide says to delete it after provisioning | STATICALLY VERIFIED |
| SEC-C | Client-trusted identity / roles | PASS. The caller comes from `x-appwrite-user-id`; body `userId`, `requesterId`, `labels`, `status` are ignored (TC-SEC-009, existing tests) | AUTOMATED (mock backend) |
| SEC-D | Unauthenticated scheduled path | **Fixed (DL-QA-001).** Before the fix, any action ran with no user when `x-appwrite-trigger: schedule` was present | AUTOMATED |
| SEC-E | Sensitive data in logs | PASS. One `console.error` in the dev-only connection test; the function logs only error messages | STATICALLY VERIFIED |
| SEC-F | Session storage | Keychain via `expo-secure-store` on device; `localStorage` on web (dev preview only) | STATICALLY VERIFIED; device NOT EXECUTED |
| SEC-G | Live row/table/bucket permissions | **BLOCKED this audit** (no live session or credentials). Carried over: verified live on 2026-10-07 (old report §0.2) | LIVE BACKEND VERIFIED (2026-10-07, prior audit) |
| SEC-H | Password policy | Client requires ≥8 characters with a letter and a digit. Appwrite breach/dictionary policy was recommended in the prior audit; current setting NOT VERIFIABLE FROM REPOSITORY | — |
| SEC-I | Shared-device leakage | **Fixed (DL-QA-011)** | AUTOMATED |

## 12. Authorization Testing

**Client route guards** (AUTOMATED, real router; UX only, not a security boundary):

| User | Tries | Lands on | Result |
| --- | --- | --- | --- |
| Signed out | `/`, `/requests/create`, `/donor/incoming/abc`, `/org/dashboard`, `/admin/dashboard` | never a private screen; `/` → welcome | PASS |
| Onboarding incomplete (even with admin + org labels) | app, org, admin | never reached | PASS |
| New, unverified email | `/login` | verify-email | PASS |
| Regular user | create request ✓; org ✗; admin ✗ | — | PASS |
| Org member | org ✓; admin ✗ | — | PASS |
| Admin | admin ✓ | — | PASS |
| Signed in | `/login` | not shown | PASS |

**Server authorization** (AUTOMATED, mock backend), test IDs TC-SEC-001..011. Each was attempted and refused (403 or 404), with state checked unchanged afterwards:

- Org A changing org B's inventory, members, profile
- Org A staff verifying or viewing matches for org B's request
- A staff member managing the team
- An org member or donor calling admin actions
- A donor confirming/scheduling/cancelling their own donation
- A stranger cancelling/completing someone else's request
- A donor answering another donor's invitation
- A payload `userId` for another user

Existing tests add: non-admin on every admin action, requester self-verify, stranger `request.matches`, foreign `notifications.markRead`.

**Read-side IDOR** (patient A reading patient B's request, donor A reading donor B's profile, other users' verification documents) is governed by **Appwrite row permissions**, which the mock backend does not model:

- Permissions set at creation: STATICALLY VERIFIED (e.g. requests `read(user:requester)`, `read(label:admin)`, `read(label:orgm<hospital>)`, contacted donors; donor_profiles owner + admin; files owner + bucket-level admin)
- Live enforcement: **BLOCKED** (needs two signed-in QA users; see §19 M-SEC-01..04)

## 13. Request Lifecycle Testing

AUTOMATED. The domain table (all pairs) is in `workflow.test` / `qaBoundaries`; API-level checks are in `qaAudit` TC-REQ-001..008 plus existing lifecycle tests.

Happy path verified: submitted → pending_verification → verified → matching → donors_contacted → partially_fulfilled → fulfilled → completed.

`draft` exists in the schema and transitions, but no code path creates drafts; the client keeps drafts in memory only.

| Scenario | Expected | Result |
| --- | --- | --- |
| Accept on a cancelled request | 409, no unit or donation | PASS |
| Verify / complete / contact donor after cancel | 409 | PASS |
| Cancel twice | 409 | PASS |
| Declined → accepted | 409 | PASS |
| Accepted → accepted again | 409 `already_accepted` | PASS |
| Accepted → declined | 409 | PASS |
| Complete before fulfilled | 409 | PASS |
| Confirm a completed donation / cancel it | 409 | PASS |
| No-show | unit released, request back to donors_contacted | PASS |
| Rejected → verified | 409; nobody contacted | PASS |
| Accept after `expiresAt`, before maintenance | 409 | **FAILED → fixed (DL-QA-005)** |
| Expiry with an accepted donor | donation cancelled **and donor told** | **FAILED → fixed (DL-QA-006)** |

## 14. Concurrency Testing

AUTOMATED on the mock backend. `Promise.all` interleaves the handlers at each `await`, which reproduces read-modify-write races deterministically. It does not reproduce real network timing.

| ID | Scenario | Before | After |
| --- | --- | --- | --- |
| existing | 2 donors accept the last single unit | 1 wins, `unitsAccepted ≤ units` | PASS |
| existing | double-tapped accept | 1 donation | PASS |
| TC-CON-001 | same client id submitted twice at once | **[200, 500]** | 200 + duplicate, one row |
| TC-CON-003 | 2 donors take the last 2 units at once | fulfilled, 2/2 | PASS (no inversion observed) |
| TC-CON-004 | requester and hospital confirm the **same** donation at once | **both 200; donationCount 2; 2 notifications** | one 200 + 409; counted once |
| TC-CON-007 | two **different** donations confirmed at once | **unitsCompleted 1 of 2; never completes** | 2/2, completed |
| TC-CON-005 | double-tapped decline | **2 notifications** | 1 |
| TC-CON-006 | double mark-read | 200/200 | PASS |

Fix technique, with no schema change:

- **Counters** use Appwrite's atomic `incrementRowColumn`; this primitive was already verified live on 2026-10-07.
- **"Exactly once" actions** first create an `audit_logs` row with a deterministic ID (`dc<donationId>`, `rd<responseId>`). Appwrite refuses a second row with the same ID (409), so only one caller proceeds. If a later write fails, the claim row is removed so the action can be retried.

**Residual race (DL-QA-013, open):** `statusHistory` is a read-modify-write JSON string. Two simultaneous status transitions on the same request can drop a history entry, or briefly leave `partially_fulfilled` while all units are accepted. It self-heals on the next confirmation. It was not reproduced in the fake backend, so it remains STATICALLY identified. A full fix needs TablesDB transactions; that is an architectural change, deferred.

## 15. E2E Testing

**Framework:** Maestro was chosen because flows are YAML and need no native config or extra dependencies. Detox would need native build changes.

**Implemented:** `.maestro/` holds 6 flows plus 2 subflows and a README with setup instructions. Credentials are passed only with `-e`; none are stored.

| Flow | Covers | Status |
| --- | --- | --- |
| 01-login-logout | login, four tabs, logout | **NOT EXECUTED** |
| 02-requester-creates-request | create → review → submit | **NOT EXECUTED** |
| 03-admin-verifies-request | admin verify → matching | **NOT EXECUTED** |
| 04-donor-accepts | alert → accept → confirmation | **NOT EXECUTED** |
| 05-requester-sees-update | alert, request details, tracking | **NOT EXECUTED** |
| 06-donor-declines (manual tag) | decline with reason | **NOT EXECUTED** |

**BLOCKED:** these flows need an Android emulator with a development build, Maestro, and dedicated QA accounts on a live Appwrite project. Creating accounts or signing in to the cloud backend from this environment was out of bounds. The selectors come from the real screen text and accessibility labels, but expect some selector tuning on the first run.

## 16. UI/UX Testing

STATICALLY VERIFIED unless a test is cited. **Not** verified on a device.

| Milestone 02 issue | Implementation | Result |
| --- | --- | --- |
| UI-01 availability noticeability | `AvailabilityHero`: large state word, colour + icon + text, one-tap toggle | Code PASS; smoke test renders "AVAILABLE" |
| UI-02 donor comparison | `DonorCard`: fixed row of group, distance, availability | Code PASS; DonorCard has **0 % test coverage** |
| UI-03 status visibility | `RequestStatusHero` with live region; timeline | Code PASS; timeline logic AUTOMATED |
| UI-04 navigation | four fixed tabs, one header | PASS (route tests + static) |
| UI-05 accept/decline emphasis | success vs outline buttons, confirm dialog, reason sheet, outcome screen | AUTOMATED (smoke + TC-DONOR-010/011) |

Other observations:

- **Error prevention:** inline field errors with consistent wording. Before DL-QA-009, an over-long Ward/unit value produced a generic "Something went wrong" with no highlighted field.
- **Feedback:** loading states and disabled buttons while in flight (TC-PATIENT-011, TC-AUTH-003). Failures re-enable the action (TC-PATIENT-012).
- **Empty/error states:** present on all screens reviewed. The Incoming screen's retry is AUTOMATED (TC-NET-010).
- **Lists:** they stop at 50–100 rows with no "load more" (OBS-05).
- **Not testable without a device:** keyboard overlap, safe areas, Android back button, long text, large fonts, small screens (§19).

## 17. Accessibility Testing

- **Labels & roles:** STATICALLY VERIFIED. All 22 `Pressable`s declare `accessibilityRole` and/or `accessibilityLabel`. Icon-only controls (back, header actions, close sheet, password reveal, dismiss toast, steppers) have explicit labels. The stepper uses the `adjustable` role with a value; FAQ rows expose `expanded` state.
- **Touch targets:** Buttons are at least 40/48/56 dp (sm/md/lg; `sm` adds 4 dp `hitSlop`). Icon buttons are 36–44 dp with 6–10 dp `hitSlop`, so the effective target is ≥ 48 dp. **Exception:** the AvailabilityHero "settings" link is 40 dp with no `hitSlop` (DL-QA-015, LOW, open).
- **Contrast:** AUTOMATED for 27 pairs in light and dark. **DL-QA-012:** muted text was 4.43:1 on the page background and 4.23:1 on `subtle` in light mode, below WCAG AA's 4.5:1; it is used 58 times, including input helper text. It was darkened from `#64748b` to `#5b6b80` (4.62–5.44:1 across backgrounds, still lighter than secondary text).
- **NOT EXECUTED:** TalkBack/VoiceOver navigation order, 200 % font scaling, switch access.

## 18. Performance Review

STATICALLY VERIFIED; no profiling was run.

| Finding | Risk | Evidence |
| --- | --- | --- |
| No `FlatList`/`FlashList` anywhere; lists render as `.map` inside the screen `ScrollView` | LOW–MEDIUM. Fine at ≤100 rows; every query is capped (`limit` 1–100) | `grep` count 0 |
| History/admin lists truncate at 50–100 rows | Functional (OBS-05) | services |
| `admin.analytics` makes about 35 sequential `count` queries per load | LOW at demo scale; slow at large scale | `admin.js` |
| Realtime: one notifications subscription; screens debounce reloads (300 ms); `useResource` drops out-of-order responses | Good | providers/hooks |
| React Compiler enabled | Reduces re-renders | `app.json` |

No optimisation was made: nothing showed a measured problem.

## 19. Manual Device Test Plan (Android): ALL NOT EXECUTED

Run this on a development build (`npx expo run:android` or EAS development profile), first on a Pixel-class emulator (API 34+), then on one physical phone. Use dedicated QA accounts only. Record pass/fail and a screenshot for each item.

| ID | Area | Steps | Expected |
| --- | --- | --- | --- |
| M-START-01 | Cold start | Install, launch | Splash, then Welcome; no red box; fonts and icons load |
| M-AUTH-01 | Register | Register → email code | 6-digit code arrives; verified → onboarding |
| M-AUTH-02 | Login keyboard | Login; Next/Done keys | Focus moves email → password; Done submits; keyboard never covers the button |
| M-AUTH-03 | Forgot password | Request code, reset | Password changes; old one rejected |
| M-ONB-01 | Onboarding | All 7 steps; Back on each | Data kept on Back; Android back doesn't exit mid-flow |
| M-PERM-01 | Location permission | Allow / Deny / "only this time" | Deny still lets the user pick a district; no crash |
| M-PICK-01 | Photo picker | Profile photo from gallery; cancel; 6 MB file | Upload works; cancel silent; oversize gives a clear error |
| M-PICK-02 | Document picker | Verification PDF + JPG | Upload progress; submit succeeds |
| M-REQ-01 | Create request | Full flow incl. ward 80+ chars | Field is capped at 80 (DL-QA-009) |
| M-REQ-02 | Double tap Submit | Tap Submit rapidly 3× | Exactly one request in "My requests" |
| M-DON-01 | Accept/decline | Two donor phones accept the last unit together | One success, one "enough donors" |
| M-NOTIF-01 | Realtime alert | Donor phone foregrounded when request verified | In-app toast + badge within seconds |
| M-NOTIF-02 | Alert deep link | Tap an alert twice quickly | Opens the right screen once; badge −1 |
| M-BACK-01 | Android back | Back from every tab and nested screen | Expected screen; app exits only from Home |
| M-BG-01 | Backgrounding | Background 5 min during tracking; resume | Data refreshes; session kept |
| M-RESTART-01 | Restart | Force-stop and relaunch | Still signed in (keychain) |
| M-NET-01 | Offline | Airplane mode, open Requests, try Accept | Offline banner; clear error; no stuck spinner; works after reconnect |
| M-NET-02 | Slow network | Network throttling, submit request | Loading state; no duplicate on retry |
| M-SEC-01 | IDOR read | User B opens `donorlink://requests/<A's id>` | "Request not found" (row permission) |
| M-SEC-02 | IDOR donor | Requester opens donor details | No phone/address/coordinates shown |
| M-SEC-03 | Files | User B fetches A's file ID via deep link | Not viewable |
| M-SEC-04 | Shared device | A types a draft, signs out; B signs in → Request blood | Empty form (DL-QA-011) |
| M-DL-01 | Deep links | `adb shell am start -d donorlink://admin/dashboard` as non-admin | Not opened |
| M-ORIENT-01 | Orientation / small screen | 360×640 emulator; landscape | No clipped buttons; scrolls |
| M-A11Y-01 | TalkBack | Navigate Home → Accept | Every control announced with a name and role |
| M-A11Y-02 | Font 200 % | System font largest | Text wraps; no overlap on key screens |
| M-THEME-01 | Dark mode | Settings → Appearance | All screens readable |

## 20. Defect Register

### 20.1 Defects found in this audit

Severity: CRITICAL / HIGH / MEDIUM / LOW. Priority: P1 (fix before demo) … P3.

All 12 fixed defects were **reproduced by a failing test first**. Each "Regression test" fails on the original code and passes now.

**DL-QA-001: Scheduled-trigger path ran any action without a user**
- **Severity / Priority:** MEDIUM / P1
- **Component:** function `handle.js`
- **Preconditions:** request with header `x-appwrite-trigger: schedule` and no user
- **Steps to reproduce:** call `admin.setAdminRole` or `support.create` that way
- **Expected:** only `maintenance.run` is allowed
- **Actual:** the handler ran with `userId=''`; a support ticket was created with no owner
- **Root cause:** the unauthenticated branch was skipped for every scheduled call
- **Fix:** unauthorized unless the trigger is schedule **and** the action is `maintenance.run`
- **Regression test:** TC-SEC-010
- **Note:** Appwrite documents this header as runtime-set. Whether a client can override it is NOT VERIFIABLE FROM REPOSITORY, so treat this as defense in depth

**DL-QA-002: Simultaneous confirmation of different donations lost a count**
- **Severity / Priority:** MEDIUM / P1
- **Component:** `donation.confirm`
- **Preconditions:** a 2-unit request with 2 accepted donors
- **Steps to reproduce:** requester and hospital each confirm a different donation at the same moment
- **Expected:** `unitsCompleted` = 2 and the request is completed
- **Actual:** `unitsCompleted` = 1; the request stays `fulfilled` until someone closes it manually
- **Root cause:** read-modify-write on `unitsCompleted`
- **Fix:** atomic `increment`
- **Regression test:** TC-CON-007

**DL-QA-003: The same donation could be confirmed twice**
- **Severity / Priority:** **HIGH** / P1
- **Component:** `donation.confirm`
- **Preconditions:** a scheduled donation
- **Steps to reproduce:** requester and hospital staff tap Confirm together
- **Expected:** counted once; the second caller gets 409
- **Actual:** both succeeded: `donationCount` +2, 2 notifications, `unitsCompleted` +2. With a 2-unit request this marks it **completed while one donor never donated**
- **Root cause:** status check then update, not atomic
- **Fix:** a fixed-ID audit row (`dc<donationId>`) acts as an atomic claim, with rollback on failure; `donationCount` is incremented atomically
- **Regression test:** TC-CON-004

**DL-QA-004: Concurrent submit with the same client id returned 500**
- **Severity / Priority:** MEDIUM / P2
- **Component:** `request.create`
- **Preconditions:** the first call is still running
- **Steps to reproduce:** double tap, or a retry after a client timeout
- **Expected:** the duplicate is answered idempotently
- **Actual:** `[200, 500]`; the user saw "Something went wrong" although the request existed
- **Root cause:** the 409 from a duplicate row ID was not handled
- **Fix:** on 409, return the existing request (same requester) or 403
- **Regression test:** TC-CON-001

**DL-QA-005: An expired request could still be accepted**
- **Severity / Priority:** LOW / P2
- **Component:** `response.accept`
- **Preconditions:** `expiresAt` has passed, but the maintenance job has not run yet (it runs every 15 min)
- **Steps to reproduce:** the donor accepts
- **Expected:** 409 "expired"
- **Actual:** 200; a donation was scheduled
- **Root cause:** only `status` was checked
- **Fix:** check `expiresAt` against the current time
- **Regression test:** TC-REQ-003

**DL-QA-006: Expiry silently cancelled accepted donors' donations**
- **Severity / Priority:** MEDIUM / P1
- **Component:** `expireRequest`
- **Preconditions:** an accepted donor
- **Steps to reproduce:** the request expires
- **Expected:** the donor is told the donation is off
- **Actual:** the donation was cancelled with **no notification**, so the donor might still travel to the hospital
- **Root cause:** `notifyAccepted: false`
- **Fix:** `notifyAccepted: true`
- **Regression test:** TC-REQ-008

**DL-QA-007: A double-tapped decline sent duplicate notifications and audit rows**
- **Severity / Priority:** LOW / P3
- **Component:** `response.decline`
- **Preconditions:** a pending invitation
- **Steps to reproduce:** tap Decline twice
- **Expected:** one decline
- **Actual:** 2 "donor declined" alerts to the requester
- **Root cause:** non-atomic status check
- **Fix:** `rd<responseId>` claim with rollback
- **Regression test:** TC-CON-005

**DL-QA-008: Re-reviewing an organization verification duplicated or failed to revoke it**
- **Severity / Priority:** MEDIUM / P1
- **Component:** `verification.review`, `request.verify`
- **Preconditions:** an organization verification that was already approved
- **Steps to reproduce:** admin marks it needs_attention and then verified again; or rejects it after approval
- **Expected:** one organization; rejecting removes its verified standing
- **Actual:** a **second organization and membership** were created; after rejection the org stayed `verified`, and its staff could still manage inventory and **verify requests**
- **Root cause:** the review always created an org and never updated an existing one; `request.verify` checked only the membership label
- **Fix:** reuse `verification.organizationId` and set its status; `request.verify` (non-admin) now requires the organization to be `verified`
- **Regression test:** TC-VER-001, TC-VER-002

**DL-QA-009: Free text longer than its database column caused a 500 and no field error**
- **Severity / Priority:** MEDIUM / P1
- **Component:** shared `validation.ts`; Create Request, Verification and Profile screens
- **Preconditions:** a Ward/unit value over 80 characters (also relationship > 60, city > 60, org address > 200, registration no. > 60)
- **Steps to reproduce:** submit the form
- **Expected:** an inline field error
- **Actual:** the validator accepted it, so live Appwrite would reject the row and the function return 500. The Ward/unit input had no `maxLength` and no error prop
- **Root cause:** validators did not mirror the schema sizes
- **Fix:** `LIMITS` plus length checks; `maxLength` and `error` on the inputs
- **Regression test:** `qaBoundaries` "free-text fields never exceed their database column" (7 cases)
- **Note:** the live 500 is inferred from the schema; the fake backend does not enforce column sizes

**DL-QA-010: A non-boolean `emergencyAlerts` value passed validation**
- **Severity / Priority:** LOW / P3
- **Component:** `validateAvailability`
- **Preconditions:** a crafted payload with `emergencyAlerts: "yes"`
- **Steps to reproduce:** call `donor.updateAvailability` with it
- **Expected:** 400
- **Actual:** 200 on the mock backend; live Appwrite would reject the boolean column → 500
- **Root cause:** no type check
- **Fix:** must be a boolean if present
- **Regression test:** TC-NET-002, `qaBoundaries` DL-QA-007 case

**DL-QA-011: Unsent request draft and donor match cache survived sign-out**
- **Severity / Priority:** MEDIUM / P1
- **Component:** `RequestDraftContext`, `matchCache`, `AuthProvider`
- **Preconditions:** shared device
- **Steps to reproduce:** user A fills Request blood (patient group, hospital, ward, notes) and signs out; user B signs in and opens Request blood
- **Expected:** empty form and a new idempotency key
- **Actual:** B saw A's draft, with A's client id. The match cache (donor names and distances) also persisted; its comment claimed "cleared on sign-out via module reload", which was false
- **Root cause:** the provider sits above the auth boundary
- **Fix:** the draft resets when the signed-in user changes; sign-out clears `matchCache`
- **Regression test:** TC-PATIENT-010, TC-AUTH-031

**DL-QA-012: Muted text below WCAG AA contrast (light mode)**
- **Severity / Priority:** LOW / P2
- **Component:** `tokens.ts`, `global.css`
- **Preconditions:** light theme
- **Steps to reproduce:** helper or caption text on the page background
- **Expected:** ≥ 4.5:1
- **Actual:** 4.43:1 on the background, 4.23:1 on `subtle`
- **Root cause:** token value
- **Fix:** `fgMuted` changed from `#64748b` to `#5b6b80`
- **Regression test:** TC-A11Y-001

**Open defects (not fixed):**

| ID | Severity / Priority | Component | Description | Reason not fixed |
| --- | --- | --- | --- | --- |
| DL-QA-013 | LOW / P3 | `transitionRequest` | Concurrent status transitions can drop a `statusHistory` entry or briefly invert `partially_fulfilled`/`fulfilled`; it self-heals on confirmation. STATICALLY identified, not reproduced | Needs TablesDB transactions (architectural) |
| DL-QA-014 | LOW / P3 | `contactDonor` | Writes the request `$permissions` from a possibly stale copy; two concurrent contacts could drop one donor's read grant. That donor gets the alert but "Request not found". STATICALLY identified | Same as above; rare |
| DL-QA-015 | LOW / P3 | `AvailabilityHero` | Settings link touch target is 40 dp with no `hitSlop` (Android guideline 48 dp) | Needs a device check; trivial to fix with `hitSlop={4}` |
| DL-QA-016 | LOW / P3 | `org.addMember` | An org admin can add any registered user by email without that user's consent; the "no account uses that email" response reveals whether an account exists | Product decision |

### 20.2 Defects from the 2026-10-07/08 audit (carried over; full detail in git history)

| ID | Sev | Summary | Status |
| --- | --- | --- | --- |
| DL-FN-001 | HIGH | Scheduled maintenance always 400 (empty body) | Fixed; LIVE BACKEND VERIFIED 2026-10-07 |
| DL-REQ-002 | MEDIUM | Concurrent accepts over-filled a request | Fixed; re-tested AUTOMATED this audit |
| DL-PRIV-003 | LOW | Notification rows were client-writable | Fixed |
| DL-SEC-004 | LOW | `avatarFileId` not validated | Fixed; AUTOMATED |
| DL-UX-005..007 | LOW | Unmatched route, copy issues | Fixed |
| DL-AUTH-009/010, DL-UI-011/012, DL-UPL-013, DL-THM-014 | — | Bug batch 2 (auth redirect, OTP endpoint, toast width, filter row, uploads, theme) | Fixed; tests in `src/__tests__/fixes` all pass |

### 20.3 Observations (not defects)

| ID | Observation |
| --- | --- |
| OBS-01 | `fulfilled` requests can never expire (no `fulfilled → expired` transition). If donors never show and nobody records a no-show, the request stays open indefinitely |
| OBS-02 | The function maps any unexpected Appwrite 400 to a generic 500 "Something went wrong". DL-QA-009/010 removed the known causes |
| OBS-03 | The Review screen guards double submit with state, not a ref (Register uses a ref). Same-frame double taps are now handled server-side (DL-QA-004 fix) |
| OBS-04 | `npm audit`: 69 findings (16 moderate, 53 high), not triaged; many are likely dev/build tooling. NativeWind 5.0.0-rc.0 and react-native-css rc are pre-release |
| OBS-05 | Lists stop at 50–100 rows with no pagination (history, admin queues) |
| OBS-06 | The bucket allows `create("users")` with no per-user quota (storage abuse possible; 5 MB/file limit applies) |
| OBS-07 | Test output contains React `act(...)` warnings from `Icon` updates in screen tests (noise only) |

## 21. Regression Testing

After all fixes:

- Full suite: **384/384**, typecheck pass, lint pass.
- All 206 baseline tests still pass, unmodified. No assertion was weakened or removed.

Red/green evidence: every new test that encodes a defect was run against the original code first.

| Suite | Failed on original code |
| --- | --- |
| `qaAudit` | 10 of 30 |
| `qaBoundaries` | 8 of 103 |
| `clientFlows` | 1 of 4 |
| `contrast` | 2 of 15 |
| `authProvider` | TC-AUTH-031, checked by stashing the fix |

Production files changed (17 files, +187/−65):

- **Function:** `handle.js`, `handlers/{request,response,donation,verification}.js`, `lib/context.js`
- **Shared domain:** `src/domain/validation.ts`
- **Client:** `RequestDraftContext.tsx`, `matchCache.ts`, `AuthProvider.tsx`, `requests/create.tsx`, `verification/details.tsx`, `settings/profile.tsx`, `(onboarding)/location.tsx`, `theme/tokens.ts`, `global.css`
- **Test config:** `package.json`

## 22. Test Coverage

Measured with an explicit denominator: all `src/**` and `appwrite/functions/api/src/**`, excluding tests, the test setup and the generated function domain copy.

| Area | Lines | Files with 0 % |
| --- | --- | --- |
| Function handlers | 88.5 % | 0 / 9 |
| Function lib | 91.9 % | 0 / 4 |
| `src/domain` | 97.5 % | 1 / 11 (`index.ts` re-exports) |
| `src/theme` | 96.0 % | 0 |
| `src/components/ui` | 71.3 % | 0 / 17 |
| `src/providers` | 70.7 % | 1 / 3 |
| `src/hooks` | 69.1 % | 1 / 6 |
| `src/lib/appwrite` | 49.8 % | 4 / 11 |
| `src/app/(auth)` | 39.6 % | 2 / 6 |
| `src/app/(app)` | 25.6 % | 22 / 31 |
| `src/components` (domain components) | 23.1 % | 13 / 21 |
| `src/features` | 15.2 % | 6 / 8 |
| `src/services` | 3.9 % | 9 / 10 |
| `src/app/(organization)` | **0 %** | 9 / 9 |
| `src/app/(admin)` | **0 %** | 15 / 15 |
| `src/app/(onboarding)` | **0 %** | 8 / 8 |
| **Total** | **50.1 %** | |

**Highest-value missing tests, in priority order:**

1. `RequestDetailsScreen` (requester verify/cancel/complete actions)
2. Organization request & inventory screens
3. Admin verification queue
4. Onboarding completion
5. `DonorCard`/`RequestTimeline`/`RequestStatusHero` (the UI-02/UI-03 HCI fixes)
6. `useApproximateLocation`
7. Services (thin wrappers; low value)

## 23. Known Limitations

1. **No live testing in this audit.** Appwrite was not accessed. Fixes are verified only on the in-memory backend, which does not model row permissions, column sizes, or real concurrency timing.
2. **Fixes not deployed.** The live function still runs the pre-audit code.
3. **No device or emulator:** every item in §19 is NOT EXECUTED. Web-preview results from the prior audit are not evidence for Android.
4. **E2E flows written, never run** (§15).
5. **No usability testing with users.** HCI conclusions are code-level only.
6. **Concurrency tests** use microtask interleaving: good for finding read-modify-write races, but not a load test.

## 24. Final Test Summary

| Measure | Value |
| --- | --- |
| Automated tests | **384** (206 pre-existing + 178 new) |
| Passed / failed / skipped | **384 / 0 / 0** |
| Blocked | Live-permission IDOR (4 checks), E2E (6 flows), device tests (27 checks) |
| Manual tests executed | 0 |
| Defects found | 12 fixed (1 HIGH, 7 MEDIUM, 4 LOW) + 4 open (all LOW) + 7 observations |
| Critical defects | 0 |
| Line coverage | 50.1 % overall; backend 81–92 %; domain 97.5 % |

## 25. Release Recommendation

**RELEASE READY WITH MINOR ISSUES**, for the university final-year/HCI demonstration, **on these conditions**:

1. Deploy the fixed function. Recreate a short-lived provisioning key, run `npm run appwrite:provision` (idempotent), then delete the key. Until then, DL-QA-001…008 and DL-QA-010 are still live.
2. Run the §19 Android smoke items, at minimum: M-START-01, M-AUTH-01/02, M-REQ-01/02, M-DON-01, M-NOTIF-01, M-BACK-01, M-NET-01, M-SEC-01/04.
3. Optional before the demo: run the Maestro flows once with QA accounts.

**For a public production release: NOT RELEASE READY.** That needs:

- live cross-user permission tests
- device and accessibility testing
- component tests for the organization and admin areas
- `npm audit` triage
- a decision on DL-QA-013/014 (transactions)

### Reproduce this QA state

```bash
npm ci
npm run typecheck
npm run lint
npm test
npx jest --coverage --collectCoverageFrom="src/**/*.{ts,tsx}" --collectCoverageFrom="appwrite/functions/api/src/**/*.js" --collectCoverageFrom="!**/__tests__/**" --collectCoverageFrom="!src/test/**" --collectCoverageFrom="!appwrite/functions/api/src/domain/**"
npx jest appwrite/functions/api/__tests__/qaAudit.test.js src/domain/__tests__/qaBoundaries.test.ts src/__tests__/qa
```
