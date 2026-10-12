# Synthetic test data and QA accounts

**No credentials, tokens, API keys or real personal data are stored here or anywhere in `testing/usability/`.** Passwords are held by the project owner and given to the facilitator out of band.

## QA accounts

The report (§9.2, §8.2) says three QA accounts were created for the live run and can be reused: `qa.requester@example.com`, `qa.donor@example.com`, `qa.reviewer@example.com`. **This package could not confirm that they exist or work**, because confirming requires signing in to the live Appwrite Cloud project, and that must be done by the project owner. `@example.com` mailboxes cannot receive the verification code, so the accounts must already be verified and onboarded (otherwise sign-in ends on the verification/onboarding screens and T1 cannot reach Home).

| Account | Role in usability sessions | Role in the Playwright E2E | Must have |
|---|---|---|---|
| **QA donor** | **The participant's account** ("the test account you were given"); makes the T2 request, sets availability (T4), accepts the alert (T5), opens history (T6) | Donor | Blood group **O+** (or O-), onboarding complete, alerts on, search radius covering Colombo district, e-mail verified |
| **QA requester** | Facilitator-operated: creates the synthetic request that becomes the T5 alert | Requester | Profile complete; e-mail verified |
| **QA reviewer** | Facilitator-operated: verifies requests (T2 → T3, and the T5 alert request) | Reviewer | A role that can verify requests (admin label or organization member for the test hospital). Set up by the owner in Appwrite; not changed by this package |

If a role cannot be provided, record it as a blocker; do not work around access control.

Matching never offers a request to its own requester, so the T2 request made by the QA donor cannot be answered by that same account. In a one-donor QA setup the T3 response count will normally be **0 of 2 accepted**. State the ground truth before T3 (see `task-success-criteria.md`).

## Synthetic records

| Record | Values | Notes |
|---|---|---|
| T2 request (made by the participant) | O+, 2 units, a hospital in Colombo, any urgency | The participant chooses the hospital freely (the card must not lead them), so it may be a real directory hospital. The facilitator cancels the request straight after T3. **Risk:** if a real organization has claimed that hospital in the shared project, its staff could see the test request. Confirm beforehand that no real organization is attached to the Colombo directory hospitals, or run the study on a **separate Appwrite project** (README step 3 and 4 create one), which is the safer option |
| T5 alert request (made by the facilitator) | Group compatible with the donor (e.g. O+), 1 unit, urgency Urgent, hospital `ZZ USABILITY TEST HOSPITAL`, district Colombo, ward `ZZ-TEST`, notes `USABILITY TEST - synthetic request, please ignore.` | One per session; cancelled afterwards |
| Optional decoy | A second verified request with a different group the donor is *not* offered, or one already cancelled | Only to check "accepts the right request" |
| History record (T6) | The previous session's cancelled request, or the T2 request | Must exist before T6 or T6 is data-blocked |

Every synthetic request is identifiable: hospital `ZZ USABILITY TEST HOSPITAL`, notes begin `USABILITY TEST`. Patient names and medical details are never entered (the app itself warns against this).

## Starting state per session

| Item | State |
|---|---|
| Phone | Signed out, app on Welcome |
| QA donor availability | Per pilot: unavailable (preferred) or available with no end time |
| Previous test requests | Cancelled in the app (not deleted) |
| T5 invitation | Present and pending on the donor's phone |

## What is never done

* No deleting rows, bulk clean-up, migrations, or resets.
* No changes to permissions, schema, auth settings or labels.
* No use of the admin/provisioning API key (`.env.provision.local`).
* No real users' data.

## Backend verification

Use the existing reviewer/organization/admin screens in the app to read request state (status, accepted count, responses). Direct database reads are not used.
