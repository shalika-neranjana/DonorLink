# DonorLink QA Test Report

**Date:** 2026-10-07
**Phase:** 1 of N — repository and architecture audit (static read only; no code modified)
**Build/environment:** Windows 11, local checkout on `master`. App not yet launched. Backend not yet queried.

| | |
|---|---|
| Expo | SDK 57 (`expo ~57.0.26`, RN 0.86.3, React 19.2.3, Expo Router ~57.0.24, React Compiler + typed routes on) |
| Appwrite | `react-native-appwrite ^1.1.0` client; `node-appwrite ^29` function `donorlink-api` (node-22); TablesDB; project not yet inspected via MCP |
| gluestack | `@gluestack-ui/core ^5.0.15`, `@gluestack-ui/utils`; NativeWind `5.0.0-rc.0` + `react-native-css 3.1.0-rc.0` (pre-release) |

**Overall status:** PASS WITH ISSUES — PARTIAL. Backend, toolchain, signed-out UI and static UX/accessibility review are done; all findings below are fixed. Signed-in flows and live cross-user permission attempts are NOT yet executed (see §1).

| Severity | Found | Fixed | Open |
|---|---|---|---|
| Critical | 0 | 0 | 0 |
| High | 1 (DL-FN-001) | 1 (verified live) | 0 |
| Medium | 1 (DL-REQ-002) | 1 | 0 |
| Low | 5 (DL-PRIV-003, DL-SEC-004, DL-UX-005, DL-UX-006, DL-UX-007) | 5 | 0 |
| Observations (not code) | DL-OBS-006 breached passwords, DL-OBS-008 package updates, DL-SUSP-004 pre-release NativeWind | — | 3 |

## 0. Results so far

| Check | Result |
|---|---|
| `npx tsc --noEmit` | PASS (no errors) |
| `npx expo lint` | PASS (no warnings printed) |
| `npx jest` | PASS — 8 suites, 158 tests (155 pre-existing + 3 added) |
| Live schema vs `appwrite/schema.mjs` | PASS — 13/13 tables, column counts and indexes match, all indexes/columns `available`, `rowSecurity` on for every table |
| Table permissions | PASS — only `organizations` and `system_settings` have table-level `read("users")`; everything else is row-level |
| Row permissions on live data | PASS — profiles/donor_profiles: owner + `label:admin` only; blood_requests: requester + admin + addressed hospital's org label |
| Bucket `files` | PASS — `fileSecurity` on, `create("users")` only, 5 MB, jpg/jpeg/png/webp/pdf, encrypted, antivirus on; 0 files stored |
| Function `donorlink-api` | Deployed, `ready`, node-22, execute=`users`, scopes match schema. **Scheduled maintenance is broken — see DL-FN-001** |

## 0.1 Confirmed bugs

### DL-FN-001 — Scheduled maintenance never runs (requests never expire)
- **Severity:** HIGH · **Category:** Backend / request lifecycle · **Screen:** none (Appwrite Function `donorlink-api`, schedule `*/15 * * * *`)
- **Steps to reproduce:** In Appwrite → Functions → `donorlink-api` → Executions, filter trigger = schedule.
- **Expected:** `maintenance.run` executes every 15 min and expires stale requests (critical 24 h, urgent 48 h, standard 72 h).
- **Actual:** All 81 scheduled executions since 2026-10-06T23:04Z returned HTTP 400 (empty body, no logs, no errors). 0 failed/5xx; the 19 HTTP executions were all 200.
- **Evidence:** Request `6ac4ef82001663854894` is `urgency=critical`, `expiresAt=2026-10-07T13:00:42Z`, still `status=matching` 5+ hours past expiry.
- **Root cause:** `src/main.js` read `req.bodyJson`, which throws on an empty body (scheduled triggers send none). The `catch` returned `bad_request` 400 before `handle()` ran, so the `schedule → maintenance.run` fallback in `handle.js` was never reached. Existing tests missed it because they call `handle()` directly, bypassing `main.js`. (Root cause inferred from code + symptoms; the runtime's `bodyJson` behaviour was not independently verified, but the new test reproduces the failure against the old code.)
- **Fix:** `main.js` now parses `req.bodyText` only when non-empty. Added `__tests__/entrypoint.test.js` (empty-body schedule, JSON body, malformed body → 400).
- **Independent confirmation:** the scheduled executions' `content-length` is 82 bytes, which is exactly the size of the `bad_request` JSON body (the `unknown_action` body would be 88).
- **Retest:** Local: test fails on old `main.js`, passes on fixed (3/3). Deployed 2026-10-07 18:3x UTC via `npm run appwrite:provision` (deployment `6ac6923ce833a0cccc13`, status `ready`). **Live confirmation: see §0.2.**

### DL-REQ-002 — Concurrent accepts could over-fill a request (was DL-SUSP-001)
- **Severity:** MEDIUM · **Category:** Request lifecycle / data integrity · **Screen:** Donor → Incoming request → Accept
- **Steps:** Two donors accept the last open unit at the same moment.
- **Expected:** exactly one accept succeeds; the other gets "enough donors".
- **Actual (original code):** `acceptResponse` did read → +1 → write on `unitsAccepted`; both calls passed the "enough donors" check and both created donations. Reproduced by the new test `never accepts more donors than units…` which **fails on the original code**.
- **Root cause:** non-atomic read-modify-write on `blood_requests.unitsAccepted` (same pattern on `contactedCount` and `releaseAcceptedUnit`).
- **Fix:** `Store.increment/decrement` use Appwrite's atomic `incrementRowColumn/decrementRowColumn` with `max = units` / `min = 0`; accept reserves the unit first, rolls it back if the follow-up writes fail (a 409 from the unique `donations.responseId` index becomes "already accepted"), and re-reads the request before choosing the next status. The fake backend now enforces the schema's unique indexes.
- **Retest:** PASS locally (6 new tests). PASS on the real service: `increment … max` past the cap returns `code=400 type=column_limit_exceeded`, `decrement … min` below the floor likewise (tested on a throwaway `system_settings` row, since deleted).
- **Residual risk:** two concurrent status *transitions* can still interleave (history is a JSON string read-modify-write); the unit counter and fulfilled/partial decision are now correct.

### DL-PRIV-003 — Notification rows were client-writable (was DL-SUSP-002)
- **Severity:** LOW · **Category:** Permissions · **Fix:** new function action `notifications.markRead` (owner-checked); notification rows are now created with `read` permission only; the 4 existing rows were migrated to read-only via MCP; unused `updateOwnRow/deleteOwnRow` helpers and `notificationService.remove` removed. Tests: foreign user gets 404; new rows carry only the owner `read` permission.

### DL-SEC-004 — `avatarFileId` not validated (was DL-SUSP-003)
- **Severity:** LOW · **Category:** Input validation · **Fix:** `profile.save` now requires the file to exist and be read-permitted by the caller (reusing the verification-document check). Test covers missing file, someone else's file, own file.

### DL-UX-005 — Unknown URLs showed Expo's stock "Unmatched Route" page
- **Severity:** LOW · **Category:** Navigation / dead end · **Steps:** open `/this-route-does-not-exist`.
- **Actual:** unbranded "Unmatched Route / Sitemap" screen. **Fix:** added `src/app/+not-found.tsx` (branded empty state with auth-aware recovery button; a first version using `replace('/')` did nothing for signed-out users because `/` is guarded — caught in retest and fixed). **Retest:** PASS in the browser (signed out → `/welcome`).

### DL-UX-006 — Pending-verification copy implied only DonorLink staff verify (was DL-SUSP-005)
- **Severity:** LOW · **Fix:** copy now reads "A DonorLink reviewer or the hospital is checking your request…". Admin request queue already defaults to the pending-verification filter, so requests at unclaimed hospitals are visible to admins.

### DL-UX-007 — Availability hero read "Until in 2 h"
- **Severity:** LOW · **Screen:** Donor Home → availability hero. `formatTimeUntil` returns "in 2 h", and the template prefixed "Until " (plus a no-op `.replace('in ','in ')`). **Fix:** now "Switches off in 2 h · Within 15 km · Emergency alerts on".

## 0.2 Live verification (Appwrite project `6ac4b77b003a7479e081`, region sgp)

| Item | Result |
|---|---|
| Deployment `6ac6923ce833a0cccc13` (`npm run appwrite:provision`, idempotent, nothing deleted) | PASS — `ready` |
| Scheduled maintenance, first post-deploy run (18:48:58 UTC) | PASS — HTTP 200 (was 400 ×81); body size 44 B = `{"ok":true,"data":{…}}` |
| Overdue request `6ac4ef82…` | PASS — `matching` → `expired`, history entry `expired @ 18:48:58`; this was admin-owned test data |
| Atomic counter semantics on real Appwrite | PASS — over-max increment and under-min decrement both `400 column_limit_exceeded` (throwaway `system_settings/qa_tmp_counter` row created and deleted; only `global` remains) |
| Notification rows migrated to read-only | PASS — 4/4 rows now `read("user:<owner>")` only |

## 0.3b Static UX / accessibility review (code-read, not yet seen signed in)

| Milestone 02 issue | Static result |
|---|---|
| UI-01 Donor availability | PASS — `AvailabilityHero`: large word (AVAILABLE / CONFIRM AVAILABILITY / CURRENTLY UNAVAILABLE), colour + icon + text, one-tap switch with a state-describing accessibility label, optimistic update with rollback and a saving guard. Copy bug DL-UX-007 fixed. |
| UI-02 Donor comparison | PASS — `DonorCard` puts blood group, distance and availability side by side in the same positions on every card; verification and match quality badges in the header; whole card has a combined accessibility label. |
| UI-03 Request status | PASS — `RequestStatusHero`: large status word, icon, colour, plain-language description, live-region announcement and re-animation on change. |
| UI-04 Navigation | PASS — four fixed tabs (Home, Requests, Alerts, Profile) defined once; unread badge with accessible label. |
| UI-05 Accept / Decline | PASS — Accept is the larger green button, Decline an outlined button; Accept goes through a confirm dialog, Decline through a reason sheet; `busy` guard blocks double actions; explicit accessibility labels; server returns clear messages for already accepted / closed / enough donors. |
| Duplicate request submission | PASS — loading-disabled submit, client-generated idempotency ID honoured by the server, plus a 15-minute near-duplicate check. |

These are code-level results only; touch-target sizes, contrast and keyboard behaviour still need an on-device/signed-in pass.

## 0.3 Browser checks (web build, signed out, `http://localhost:8081`)

| Check | Result |
|---|---|
| Startup: bundles, no red screen, no uncaught errors, fonts/icons load | PASS (only console error is the expected guest `account.get` 401) |
| Splash → auth routing | PASS (lands on `/welcome`) |
| Signed-out deep links `/admin/dashboard`, `/org/dashboard`, `/requests/create`, `/donor/incoming/abc` | PASS — all redirect to `/welcome` |
| Unknown route | FIXED (DL-UX-005) |

## 1. Blockers / limits for dynamic testing

- **Authenticated testing:** The 4 existing Appwrite users are real-looking accounts (one is the project admin). I have not signed in as any of them. Creating accounts and typing passwords to sign in are actions I must not perform on a cloud service even with approval, so signed-in flows (request create/track, donor accept/decline, notifications, history, profile, org, admin) and live cross-user permission attempts are **NOT YET TESTED against the real backend**. They are covered only by the 164-test suite on an in-memory fake.
- Appwrite password policies (dictionary / personal-data) are project security settings; left for the owner to change (DL-OBS-006).
- Expo MCP (`plugin:expo:expo`) needs OAuth authorization by the user; unavailable until then.
- gluestack MCP is configured in `.mcp.json` (local `node` server); not yet queried.
- Function executions list hides request/response bodies, so which actions were called cannot be inferred from logs.

## 1. Blockers / limits for dynamic testing

- **Authenticated testing:** The 4 existing Appwrite users are real-looking accounts (one is the project admin). I have not signed in as any of them. Creating test accounts requires the app or the Appwrite MCP to create users in the live cloud project (not a local dev backend), which needs explicit approval.
- Expo MCP (`plugin:expo:expo`) needs OAuth authorization by the user; unavailable until then.
- gluestack MCP is configured in `.mcp.json` (local `node` server); not yet queried.
- Function executions list hides request/response bodies, so which actions were called cannot be inferred from logs.

## 2. Architecture (from static audit)

- **Routing:** Expo Router in `src/app/`. Root `_layout.tsx` uses `Stack.Protected` guards: `(auth)` for signed-out (or email-verification step), `(onboarding)` when profile `onboardingComplete` is false, `(app)` for signed-in, `(organization)` only if the user has an organization label, `(admin)` only if the admin label, `gallery` only in `__DEV__`. Guards are client-side UX; real authorization is enforced by the function (see §4).
- **Route groups:** `(auth)`: welcome, login, register, forgot-password, verify-email. `(onboarding)`: personal-info, blood-info, donation-preferences, notification-preferences, location, permissions, complete. `(app)`: tabs (index, requests, notifications, profile), requests (create, review, matching, tracking, `[id]`, donor/`[id]`), donor (availability, incoming/`[id]`, donation/`[id]`), history (index, requests, donations, `[id]`), hospitals, settings (index, profile, notifications, privacy, security), verification (index, email, details), support. `(organization)/org`: dashboard, requests, request/`[id]`, donors, inventory, profile, verification. `(admin)/admin`: dashboard, users, user/`[id]`, requests, request/`[id]`, verification, organizations, inventory, analytics, audit, tickets, settings, more.
- **State:** React context providers (`AuthProvider`, `NotificationsProvider`, `OrganizationContext`, `OnboardingContext`, `RequestDraftContext`); `useResource` data hook; Appwrite Realtime in `src/lib/appwrite/realtime.ts`.
- **Services:** `src/services/*` (profile, request, matching, donor, donation, notification, verification, organization, admin, support) over `src/lib/appwrite/{client,config,api,database,auth,files,realtime,errors,secureStorage}`.
- **Domain:** `src/domain/*` (blood groups, statuses, transitions, tracking, matching, geo, districts, validation, permissions, notifications) is mirrored in `appwrite/functions/api/src/domain` so client and server share rules.
- **Backend model:** Clients **read** rows via row-level permissions; **writes** go through `callApi()` → Appwrite Function `donorlink-api` (authenticates via trusted `x-appwrite-user-id`, re-validates input, enforces transition tables, writes audit log, honours maintenance mode). Exception: owners may update/delete their own `notifications`.
- **Tables (13):** profiles, donor_profiles, blood_requests, request_responses, donations, organizations, organization_members, blood_inventory, notifications, verifications, audit_logs, support_tickets, system_settings. One private bucket `files` (avatars + verification docs; 5 MB; jpg/png/webp/pdf; encrypted; file-level security).
- **Existing tests:** jest (`jest-expo`): domain tests (matching, validation), screen smoke tests (`src/__tests__/screens`), function tests (`requestLifecycle`, `securityAndOrganizations`). Not yet run.
- **TODO/any scan of `src/`:** no TODO/FIXME/`@ts-ignore`/`any` found outside test mocks.
- **Mock data:** none in runtime code found by scan; `src/app/gallery.tsx` is a dev-only component gallery. Directory hospitals are seeded as unclaimed/unverified (by design).
- **Secrets:** `.mcp.json` is untracked and contains no credentials. `.env` contents were not inspected.

## 3. Test matrix status

| # | Area | Status |
|---|---|---|
| 1–35 | All categories in the QA brief | **NOT YET TESTED** (static audit only) |

## 4. Suspected issues from code reading (must be reproduced before fixing)

| ID | Sev | Area | Observation | Next step |
|---|---|---|---|---|
| DL-SUSP-001 | MEDIUM | Request lifecycle / concurrency | `acceptResponse` reads `request.unitsAccepted` and writes `+1` (read-modify-write, non-atomic). Two donors accepting simultaneously could both pass the "enough donors" check and over-accept or lose a count. Same pattern in `contactDonor` (`contactedCount`) and `releaseAcceptedUnit`. | Reproduce with the fake backend in `appwrite/functions/api/__tests__/helpers` using concurrent calls; consider conditional re-read/guard. |
| DL-SUSP-002 | LOW | Permissions | Owners hold `update` on their own `notifications` rows; Appwrite permissions are row-level, so a client can rewrite any column (title, body, route) of its own notification. Self-only impact. | Verify via Appwrite MCP; document as accepted risk or restrict to function-only. |
| DL-SUSP-003 | LOW | Input validation | `saveProfile` accepts any non-empty string as `avatarFileId` without checking the file exists or is owned by the caller (unlike `assertOwnFiles` for verification docs). | Confirm; add ownership check if reproducible. |
| DL-SUSP-005 | MEDIUM | Request verification / UX | Live requests `6ac619d4…` (NHSL) and `6ac674bf…` (De Soysa) are `pending_verification` at **unclaimed** directory hospitals (no members). Only that hospital's members or an admin can verify, so these can only be unblocked by an admin. Requester sees "awaiting verification" with no indication nobody at the hospital can act. | Check what the requester UI says for unclaimed hospitals and whether admin queue surfaces them. |
| DL-OBS-006 | LOW | Account security | Appwrite flags 3 of 4 accounts `passwordPwned: true` (password in breach lists). Project auth settings not inspected. | Consider enabling "password dictionary" / breach check in Appwrite Auth settings. |
| DL-SUSP-004 | LOW | Dependencies | NativeWind `5.0.0-rc.0` and `react-native-css 3.1.0-rc.0` are pre-release. | Note in risk register; no change. |

## 5. Plan for remaining phases

1. Run `tsc --noEmit`, `expo lint`, `jest` (baseline) — blocked until command execution works.
2. Inspect live Appwrite project via MCP: tables/columns/indexes vs `appwrite/schema.mjs`, table/bucket permissions, function deployment and scopes, users/labels.
3. Launch app (built-in browser preview on web, since it is in `PhoneFrame`), walk auth → onboarding → requester → donor → notifications → history → profile → org → admin.
4. Permission/security tests (cross-user reads, role escalation attempts) against the real backend using clearly labelled synthetic test accounts.
5. Accessibility, UX (UI-01…UI-05), performance review; fix confirmed bugs minimally; regression; final scorecard.

## 6. Interim scorecard (honest scope: PASS = verified; UNTESTED = not executed)

| Area | Status | Notes |
|---|---|---|
| Startup | PASS | Web build boots, no red screen, assets load |
| Navigation | PASS (signed out) / UNTESTED (signed in) | Guards verified for 4 private routes; unknown route fixed |
| Authentication | UNTESTED against live backend | Code reviewed (loading guards, field errors, keyboard flow); jest covers logic |
| Onboarding | UNTESTED | |
| Requests | PASS (backend, fake + live primitives) / UNTESTED (UI) | Race and expiry fixed and verified |
| Matching | PASS (jest `matching.test.ts`, function lifecycle tests) / UNTESTED live | |
| Donor | PASS (backend) / UNTESTED (UI) | |
| Notifications | PASS (backend) / UNTESTED (UI, realtime) | |
| History / Profile / Verification | UNTESTED (UI) | Avatar ownership fix verified by test |
| Organization / Inventory / Admin | UNTESTED | Server-side role checks covered by `securityAndOrganizations.test.js` |
| Appwrite | PASS | Schema, permissions, bucket, function, schedule verified live |
| Security | PASS WITH GAPS | Live cross-user attempts not run; password policy recommendation open |
| Privacy | PASS (design/data review) | Donor rows owner+admin only; matching server-side; coarse coordinates |
| Accessibility / Visual UX | PARTIAL (static) | |
| Performance | UNTESTED | |

## 7. Recommended next steps

1. Sign in as two synthetic users in the browser pane (owner-created) so signed-in flows and live cross-user permission tests can be run.
2. In Appwrite Console → Auth → Security, enable *password dictionary* and *personal data* policies (3 of 4 current accounts are flagged as breached).
3. `npx expo install --check` (Expo 57.0.26 → ~57.0.27 and 4 other packages flagged by the dev server).
4. Commit the changes (nothing has been committed).

## 8. Bug batch 2 (2026-10-08): auth, toast, alerts, photo upload, theme

| ID | Bug | Root cause | Fix |
|---|---|---|---|
| DL-AUTH-009 | Sign-up stays on the register screen until reload | Root-layout `Stack.Protected` guards only decide which route *groups* are reachable; nothing moves a user between screens inside `(auth)`. After sign-up the group stays open (email unverified) and `initialRouteName` only applies on mount. Same for signing in with an unverified account, and "Use a different account" left the verify screen open while signed out. | `(auth)/_layout.tsx` redirects: verifying user → `/verify-email`; signed-out on verify screen → `/welcome`. Ref-based in-flight guards on register, login, verify, resend. Sign-up reports "account created, sign-in failed" instead of a misleading duplicate error. |
| DL-AUTH-010 | Correct emailed code never verifies | Code was sent with `createEmailVerificationOTP` (`/account/verifications/email/otp`) but confirmed with `updateEmailVerification` (`/account/verifications/email`, the link-token endpoint). | Confirm with `updateEmailVerificationOTP`; the verified user returned is applied directly (`refreshUser(known)`), no second request. Resend clears the old code. Expiry (15 min) and single use are enforced by Appwrite. |
| DL-UI-011 | Toast is a thin vertical line on Expo Go | `w-[92%]`: every ancestor in gluestack's native toast list shrinks to content, so a percentage width collapses to 0 and only the 4px colour bar remains. | Explicit width from `useWindowDimensions` (screen − 32, max 420); removed duplicate Reanimated enter/exit layer. |
| DL-UI-012 | Alerts filter row takes the whole screen | A horizontal `ScrollView` has `flexGrow: 1` in RN; inside the screen's growing content container it claimed all free height. | `style={{ flexGrow: 0 }}` on the scrollable segmented control (only horizontal ScrollView in the app). |
| DL-UPL-013 | Profile photo upload fails (also verification documents) | `uploadPrivateFile` granted `read(label:admin)`; Appwrite: "A project user can only grant permissions to a resource that they have", so every non-admin upload was rejected. Also: blocking media-library permission prompt (not required by the system picker), `size \|\| 1` fallback, name/MIME taken from nullable picker fields. | Owner-only `read`+`delete` on the file; admin read moved to the bucket (`read("label:admin")`, applied live and in `schema.mjs`). New `toPickedFile` normalises name/extension/MIME/size. No permission gate for library picking; cancel is silent; double-tap guard; orphan file deleted if saving the reference fails. |
| DL-THM-014 | Theme could not be chosen | Theme followed only the system through `prefers-color-scheme` CSS and `useColorScheme`. | `ThemePreferenceProvider` (System / Light / Dark, AsyncStorage `donorlink.themePreference`), one resolved scheme feeding hex palette, navigation theme, status bar, CSS variables and `Appearance.setColorScheme`. Settings → Appearance. Splash held until the saved value is applied. Web preview stays on the browser setting. |

Validation: `tsc` clean, `expo lint` clean, 197 tests (33 new in `src/__tests__/fixes`); 17 of those 33 fail against the original code. Web check on the live dev server: toast renders (420 px, centred, auto-dismisses). **Not verified on a device or in Expo Go**; see manual checks in the hand-off message.
