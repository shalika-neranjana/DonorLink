# DonorLink Test Case Matrix (QA audit 2026-10-09)

Companion to [qa-report.md](qa-report.md).

- **Status:** PASS = executed and passing in this audit; FIXED = failed on the original code, passes after the fix; NOT EXECUTED = written or planned but not run.
- **Severity:** for a FIXED case, the defect's severity; otherwise the impact if the case failed.
- **Requirement:** a capability ref from qa-report §5. FR/NFR numbering does not exist in the repository.

Evidence paths:

- `qaAudit` = `appwrite/functions/api/__tests__/qaAudit.test.js`
- `qaBoundaries` = `src/domain/__tests__/qaBoundaries.test.ts`
- `qa/*` = `src/__tests__/qa/*`
- `smoke` = `src/__tests__/screens/screens.smoke.test.tsx`

## Authentication & routing

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-AUTH-001 | F-01 | Register screen | Component | Signed out | Press Create account with empty form | — | 3 required-field errors; no server call | As expected | PASS | MEDIUM | qa/screensQa |
| TC-AUTH-002 | F-01 | Register screen | Component | Signed out | Weak password, then mismatched confirm | `password`, `password1`/`password2` | Letter+number rule; "Passwords do not match." | As expected | PASS | MEDIUM | qa/screensQa |
| TC-AUTH-003 | F-01, N-04 | Register screen | Component | Valid form | Double tap; server rejects; tap again | duplicate email error | One sign-up call; banner; form usable | As expected | PASS | MEDIUM | qa/screensQa |
| TC-AUTH-010 | F-03 | Root layout | Integration (real router) | Signed out | Open 5 private URLs | `/`, `/requests/create`, `/donor/incoming/abc`, `/org/dashboard`, `/admin/dashboard` | No private screen | Welcome/auth only | PASS | HIGH | qa/routeGuards |
| TC-AUTH-011 | F-03 | Root layout | Integration | Signed out | Open `/` | — | Welcome | Welcome | PASS | LOW | qa/routeGuards |
| TC-AUTH-012 | F-02, F-03 | Root layout | Integration | Onboarding incomplete, admin+org labels | Open app/org/admin URLs | — | None reachable | As expected | PASS | HIGH | qa/routeGuards |
| TC-AUTH-013 | F-01 | Auth layout | Integration | New, unverified | Open `/login` | — | verify-email | verify-email | PASS | MEDIUM | qa/routeGuards |
| TC-AUTH-014 | F-03 | Root layout | Integration | Regular user | Open create, org, admin | — | Create only | As expected | PASS | HIGH | qa/routeGuards |
| TC-AUTH-015 | F-03 | Root layout | Integration | Org member | Open org, admin | — | Org only | As expected | PASS | HIGH | qa/routeGuards |
| TC-AUTH-016 | F-03 | Root layout | Integration | Admin | Open admin | — | Admin dashboard | As expected | PASS | MEDIUM | qa/routeGuards |
| TC-AUTH-017 | F-03 | Root layout | Integration | Signed in | Open `/login` | — | Not shown | As expected | PASS | LOW | qa/routeGuards |
| TC-AUTH-020 | F-01 | App | E2E (Maestro) | QA requester account | Login, check tabs, logout | env credentials | 4 tabs; back to Welcome | — | NOT EXECUTED | MEDIUM | .maestro/01 |
| TC-AUTH-030 | F-01 | AuthProvider | Component | Saved session | Launch | mocked user | signedIn | As expected | PASS | MEDIUM | qa/authProvider |
| TC-AUTH-031 | N-03 | AuthProvider | Component | Signed in, cached matches | Sign out | cached donor `d1` | Cache empty | Cache kept on original code | FIXED | MEDIUM | qa/authProvider (DL-QA-011) |
| TC-AUTH-032 | F-01 | AuthProvider | Component | No session | Launch | — | signedOut | As expected | PASS | LOW | qa/authProvider |

## Patient / requester

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-PATIENT-010 | N-03 | RequestDraftContext | Component | User A typed draft | Sign A out, B in | ICU ward, surgery notes | B sees empty draft, new client id | B saw A's draft (original) | FIXED | MEDIUM | qa/clientFlows (DL-QA-011) |
| TC-PATIENT-011 | F-04, N-04 | Review screen | Component | Valid draft | Tap Submit 3× | — | 1 API call; navigate to matching | As expected | PASS | HIGH | qa/clientFlows |
| TC-PATIENT-012 | F-04, N-05 | Review screen | Component | First call times out | Submit, then retry | timeout AppError | Error banner; retry reuses client id | As expected | PASS | HIGH | qa/clientFlows |
| TC-PATIENT-013 | F-04 | Review screen | Component | Near-duplicate | Submit | `duplicate_request` | Banner + "Open my requests" | As expected | PASS | LOW | qa/clientFlows |
| TC-PATIENT-020 | F-04 | App | E2E | QA requester | Create → review → submit | O+, critical, NHSL | "Request submitted" | — | NOT EXECUTED | HIGH | .maestro/02 |
| TC-PATIENT-021 | F-09 | App | E2E | After TC-DONOR-020 | Open alerts, request, tracking | — | Accepted status visible | — | NOT EXECUTED | HIGH | .maestro/05 |
| TC-REQ-007 | F-04 | `request.create` | API (mock) | Requester | Create with boundary units | 0, 21, 1.5, "2", −1, 20, 1 | 400 for invalid; 200 for 1 and 20 | As expected | PASS | MEDIUM | qaAudit |
| TC-CON-001 | N-04 | `request.create` | API concurrency | Requester | Two creates, same client id, at once | `same1` | One row; no 500 | [200, 500] on original | FIXED | MEDIUM | qaAudit (DL-QA-004) |
| TC-CON-002 | N-04 | `request.create` | API (mock) | Existing request | Retry same id; stranger replays id | `retry1` | duplicate:true; stranger 403 | As expected | PASS | HIGH | qaAudit |

## Donor

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-DONOR-010 | F-07, N-05 | Incoming screen | Component | Pending invite | Accept; server says enough donors | `enough_donors` | Toast; reload; no success screen | As expected | PASS | MEDIUM | qa/screensQa |
| TC-DONOR-011 | F-07 | Incoming screen | Component | Request cancelled | Open | — | No Accept/Decline; "This request is cancelled" | As expected | PASS | MEDIUM | qa/screensQa |
| TC-DONOR-012 | F-07 | Incoming screen | Component | Not invited | Open someone else's request | — | "This request isn't available" | As expected | PASS | MEDIUM | qa/screensQa |
| TC-DONOR-020 | F-07 | App | E2E | Verified request, available donor | Alert → Accept → confirm | — | "You've accepted this request" | — | NOT EXECUTED | HIGH | .maestro/04 |
| TC-DONOR-021 | F-07 | App | E2E | Second invite | Decline with reason | Too far away | "You've declined…" | — | NOT EXECUTED | MEDIUM | .maestro/06 |
| TC-REQ-002 | F-07 | `response.*` | API (mock) | 2-unit request | Decline → accept; accept twice; accept → decline | — | 409 each; units = 1 | As expected | PASS | HIGH | qaAudit |
| TC-REQ-003 | F-12 | `response.accept` | API (mock) | `expiresAt` passed, maintenance not run | Accept | clock +1 h past expiry | 409; no donation | 200 on original | FIXED | LOW | qaAudit (DL-QA-005) |
| TC-CON-003 | N-04 | `response.accept` | API concurrency | 2 units, 2 donors | Both accept at once | — | 2/2, fulfilled | As expected | PASS | HIGH | qaAudit |
| TC-CON-005 | N-04 | `response.decline` | API concurrency | Pending invite | Decline twice at once | — | 1 notification | 2 on original | FIXED | LOW | qaAudit (DL-QA-007) |
| existing | N-04 | `response.accept` | API concurrency | 1 unit | Two donors accept at once | — | One wins | As expected | PASS | CRITICAL | concurrencyAndHardening |

## Donation coordination & lifecycle

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-REQ-001 | F-08 | request lifecycle | API (mock) | Cancelled request | Cancel/verify/complete/contact/accept | — | All 409; no unit or donation | As expected | PASS | HIGH | qaAudit |
| TC-REQ-004 | F-08 | `donation.confirm` | API (mock) | 1-unit request | Complete early; accept; confirm; reconfirm; cancel | — | 409 / completed / 409 / 409 | As expected | PASS | HIGH | qaAudit |
| TC-REQ-005 | F-08 | `donation.cancel` | API (mock) | Accepted donor | No-show | `noShow: true` | Unit released; donors_contacted | As expected | PASS | MEDIUM | qaAudit |
| TC-REQ-006 | F-05 | `request.verify` | API (mock) | Pending | Reject, then verify | note | 409; nobody contacted | As expected | PASS | MEDIUM | qaAudit |
| TC-REQ-008 | F-12 | maintenance | API (mock) | Accepted donor | Expire request | clock past expiry | Donation cancelled + donor notified | No notification on original | FIXED | MEDIUM | qaAudit (DL-QA-006) |
| TC-CON-004 | N-04 | `donation.confirm` | API concurrency | 1 donation | Requester + hospital confirm at once | — | One 200; count 1 | Both 200; count 2 | FIXED | HIGH | qaAudit (DL-QA-003) |
| TC-CON-007 | N-04 | `donation.confirm` | API concurrency | 2 donations | Confirm both at once | O− request, 2 donors | unitsCompleted 2; completed | 1 of 2 | FIXED | MEDIUM | qaAudit (DL-QA-002) |
| TC-CON-006 | N-04 | `notifications.markRead` | API concurrency | Unread notification | Mark read twice at once | — | 200/200 | As expected | PASS | LOW | qaAudit |

## Organization & admin

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-ORG-001 (=TC-SEC-001) | F-10 | `org.updateInventory` | API security | Orgs A, B verified | A edits B's inventory | O+ whole blood | 403; nothing written | As expected | PASS | HIGH | qaAudit |
| TC-ORG-002 (=TC-SEC-002) | F-10 | `org.*` | API security | Orgs A, B | A adds/removes/edits B | nurse1 email | 403 ×3 | As expected | PASS | HIGH | qaAudit |
| TC-ORG-003 (=TC-SEC-003) | F-05 | `request.verify` | API security | Request at B | A staff verifies / views matches | — | 403; B staff 200 | As expected | PASS | HIGH | qaAudit |
| TC-ORG-004 (=TC-SEC-004) | F-10 | `org.*` | API security | Staff role | Add/remove members | — | 403 | As expected | PASS | MEDIUM | qaAudit |
| TC-VER-001 | F-10 | `verification.review` | API (mock) | Approved org verification | needs_attention → verified | Galle Blood Centre | One org, one membership | 2 orgs on original | FIXED | MEDIUM | qaAudit (DL-QA-008) |
| TC-VER-002 | F-05, F-10 | `verification.review`, `request.verify` | API (mock) | Approved org | Reject after approval; manage inventory | — | Org rejected; inventory 403 | Stayed verified | FIXED | MEDIUM | qaAudit (DL-QA-008) |
| TC-ADMIN-001 (=TC-SEC-005) | F-11 | `admin.*` | API security | Org member, donor | Call 5 admin actions | — | 403 ×10; no labels changed | As expected | PASS | CRITICAL | qaAudit |
| TC-ADMIN-002 (=TC-SEC-011) | F-11, N-03 | `admin.listUsers/getUser` | API (mock) | Admin | List and get users | — | Only safe fields; no phone | As expected | PASS | MEDIUM | qaAudit |
| TC-ADMIN-020 | F-11 | Admin console | E2E | QA admin | Requests → Verify | — | "Request verified" | — | NOT EXECUTED | HIGH | .maestro/03 |
| TC-ORG-UI | F-10 | Org screens | Component | — | — | — | — | No tests exist (0 % coverage) | NOT TESTED | MEDIUM | qa-report §22 |
| TC-ADMIN-UI | F-11 | Admin screens | Component | — | — | — | — | No tests exist (0 % coverage) | NOT TESTED | MEDIUM | qa-report §22 |

## Security (others)

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-SEC-006 | N-01 | `donation.*` | API security | Donor accepted | Donor confirms/schedules/cancels own donation; stranger confirms | — | 403 ×4 | As expected | PASS | HIGH | qaAudit |
| TC-SEC-007 | N-01 | `request.cancel/complete` | API security | Requester's request | Stranger/donor cancel; stranger complete | — | 403; status unchanged | As expected | PASS | HIGH | qaAudit |
| TC-SEC-008 | N-01 | `response.*` | API security | Invites for don1, don2 | Uninvited user accepts/declines | — | 404; responses pending | As expected | PASS | HIGH | qaAudit |
| TC-SEC-009 | N-01 | `profile.save`, `support.create` | API security | — | Send `userId` of another user | `userId: don1` | Caller's own rows only | As expected | PASS | CRITICAL | qaAudit |
| TC-SEC-010 | N-01 | `handle.js` | API security | No user, `schedule` trigger | Call admin/support actions | — | Refused; only maintenance runs | support.create ran on original | FIXED | MEDIUM | qaAudit (DL-QA-001) |
| M-SEC-01..04 | N-01, N-03 | Live Appwrite | Manual | 2 QA users | See qa-report §19 | — | Row permissions deny | — | NOT EXECUTED (BLOCKED) | HIGH | qa-report §19 |

## Network / malformed input

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-NET-001 | N-05 | all 33 actions | API fuzz | User, admin | 10 malformed payloads each | null, string, number, arrays, bad IDs | Never 5xx | 0 failures | PASS | MEDIUM | qaAudit |
| TC-NET-002 | N-02 | create / profile / availability / verification | API (mock) | — | Malformed nested fields | object hospitalId, string location, `emergencyAlerts: "yes"`, string fileIds | 400 each | availability 200 on original | FIXED | LOW | qaAudit (DL-QA-010) |
| TC-NET-010 | N-05 | Incoming screen | Component | Offline load | Load fails, then Try again | network AppError | Error state → content | As expected | PASS | MEDIUM | qa/screensQa |
| TC-NET-020 | N-05 | AuthProvider | Component | Offline at launch | Launch, retry | network AppError | Error state (not signed out) → signedIn | As expected | PASS | MEDIUM | qa/authProvider |
| M-NET-01/02 | N-05 | Device | Manual | Device | Airplane mode / throttle | — | See qa-report §19 | — | NOT EXECUTED | MEDIUM | qa-report §19 |

## Notifications

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-NOTIF-001 | F-09 | NotificationsProvider | Component | Unread alert, badge 3 | Open alert | `/donor/incoming/req1` | markRead once; navigate; badge 2 | As expected | PASS | MEDIUM | qa/screensQa |
| TC-NOTIF-002 | F-09 | NotificationsProvider | Component | Read alert | Open | — | No server call; navigate | As expected | PASS | LOW | qa/screensQa |
| TC-NOTIF-003 | F-09, N-05 | NotificationsProvider | Component | markRead fails | Open | network error | Still navigates | As expected | PASS | LOW | qa/screensQa |

## Domain units & accessibility

| Test ID | Requirement | Module | Test Type | Preconditions | Test Steps | Test Data | Expected Result | Actual Result | Status | Severity | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TC-DOM-001 | F-06 | bloodGroups | Unit | — | All 64 donor→recipient pairs | 8×8 groups | Matches independent ABO/Rh rule | 64/64 | PASS | CRITICAL | qaBoundaries |
| TC-DOM-002 | F-08 | transitions | Unit | — | 8 invalid request transitions; self-transitions; final states | — | All refused | As expected | PASS | HIGH | qaBoundaries |
| TC-DOM-003 | F-04 | validation | Unit | — | Units, required-by and radius boundaries | listed in file | As specified | As expected | PASS | MEDIUM | qaBoundaries |
| TC-DOM-004 | N-02 | validation vs schema | Unit | — | Column size and +1 for 10 fields | `x`×size | Size ok; +1 rejected | 7 fields accepted +1 on original | FIXED | MEDIUM | qaBoundaries (DL-QA-009) |
| TC-DOM-005 | F-07 | matching | Unit | Temporarily unavailable donor | Evaluate | — | Excluded | As expected | PASS | HIGH | qaBoundaries |
| TC-A11Y-001 | N-06 | tokens | Unit | — | 14 text/background pairs, light + dark | tokens.ts | ≥ 4.5:1 | fgMuted 4.43 / 4.23 on original | FIXED | LOW | qa/contrast (DL-QA-012) |
| TC-A11Y-002 | N-06 | tokens | Unit | — | Disabled label contrast | — | ≥ 3:1 | As expected | PASS | LOW | qa/contrast |
| M-A11Y-01/02 | N-06 | Device | Manual | TalkBack / 200 % font | See qa-report §19 | — | — | — | NOT EXECUTED | MEDIUM | qa-report §19 |

Pre-existing suites (206 tests: lifecycle, organizations, verification, support, analytics, matching, validation, workflow, consistency, auth fixes, uploads, theme, smoke screens) all pass and are not repeated here.
