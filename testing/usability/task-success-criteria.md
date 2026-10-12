# Task success criteria and measurement (facilitator and note-taker)

Screen names, labels and states below were read from the source code at commit `96e9dab`. **None of this has been observed with a participant.** If the app differs on the day, record the real wording and keep the intent of the PDF criterion.

## Outcome codes (all tasks)

| Code | Rule (PDF Appendix C.3) |
|---|---|
| **Completed unaided** | Success state reached, no hint given |
| **Completed with assistance** | Success state reached after one neutral hint (stuck 60 s, or asked twice) |
| **Abandoned** | Participant gave up, or not finished in 3 minutes |
| **Application-blocked** | A defect (error, crash, missing data) stopped the task even though the participant's actions were on the success path. Not counted as completed. Write the symptom, take a screenshot, log an issue |
| **Not attempted** | Session ended or participant declined to try |

* **Time on task:** from the end of reading the card to the success state (stopwatch seconds, or start/end times). Time only counts for completed attempts.
* **Error:** any action that leaves the success path (wrong tab, wrong button, invalid submission). **Recovery:** back on the path without help. **Hesitation:** a pause longer than 5 s without acting [Additional].
* **SEQ** straight after each task, even if it failed: "Overall, how easy or difficult was this task?" 1 = very difficult, 7 = very easy.

## Accounts used in a session

Participant device: the **QA donor** account (the "test account you were given"; also able to request blood). Facilitator-side: **QA requester** (source of the T5 alert) and **QA reviewer** (verifies requests). Details and set-up: `test-data/synthetic-data.md`. No credentials are written in this repository.

---

## T1: Sign in  *(NFR08)*

| | |
|---|---|
| **Precondition** | App installed, signed out. QA donor account exists, e-mail verified, onboarding complete (otherwise login ends on verify/onboarding and the task cannot reach Home). |
| **Expected behaviour** | Welcome → "I already have an account" → Login ("Welcome back") → Sign in → Home with greeting and the "Need blood urgently?" card. |
| **Success** | Home screen visible **without help**. |
| **Common non-success** | Participant taps "Create an account" (error); typing the wrong password (error; note the app message); account stuck on verification (application-blocked). |
| **Measure** | Time, errors, assists, SEQ. |
| **Backend check** | None needed (session exists = Home visible). |
| **Screenshots** | Sign-in screen, Home after sign-in. |

## T2: Create an emergency request  *(FR01, NFR01)*

| | |
|---|---|
| **Precondition** | Signed in as QA donor; profile complete. |
| **Expected behaviour** | Home "Request blood" → form "Request blood": blood group **O+**, units **2** (default is 1), urgency (any; scenario says "urgently"), hospital in **Colombo** (pick from list, or "Other hospital (not listed)" + district Colombo), → "Review request" → check details → "Submit request" → toast "Request submitted" → Matching screen. |
| **Success** | The request is **submitted** and its status shows **"Awaiting verification"** (pending_verification). Accept either blood group **O+**, units **2**, hospital/district Colombo. If the participant picks another urgency, still success. |
| **Common non-success** | Leaving units at 1; wrong group; not finding "Review request"; stopping at the Review screen without "Submit request" (abandoned); validation errors (count as errors). |
| **Backend check (facilitator, reviewer view)** | Exactly **one** new request by the participant: group O+, units 2, district Colombo, status `pending_verification`. More than one = double submit (log it). |
| **After the task** | Facilitator notes the request ID, then **verifies it** with the QA reviewer account while the participant answers the SEQ (see T3). |
| **Screenshots** | Filled form, Review screen, submitted state. |

## T3: Check status and response count  *(FR03, FR07, UI-03)*

| | |
|---|---|
| **Precondition** | The T2 request exists. **Ground truth recorded just before the card is read**: open the request in the reviewer view and write the *status badge* and the *Contacted / Accepted / Waiting / Declined* counters on the recording sheet. |
| **Expected behaviour** | Participant opens Requests tab / Home "Your active requests" card → Request details with the large status card; "Donor responses: N of 2 donors accepted" (and counters Contacted / Accepted / Waiting / Declined); "Track this request" opens the timeline. |
| **Success** | Participant states **both** (a) the **status** matching the ground truth (e.g. "Awaiting verification" if not yet verified, or "Verified"/"Finding donors" if the reviewer has verified) and (b) the **response count** matching the ground truth (**accepted** count, i.e. "N of 2"). If the participant says "no donors have responded / 0 of 2" and the ground truth is 0 accepted and 0 declined, that is correct. If declined > 0 the participant may answer with accepted, or accepted + declined; record the exact words and judge against the ground truth. |
| **Common non-success** | Reading the status of a different request; saying "verified" while the badge says awaiting; reading units (2) as the donors count. |
| **Expected in a one-donor QA setup** | No second donor exists, so the usual ground truth is **0 of 2 accepted**. State the ground truth anyway. |
| **Backend check** | Compare what the participant said with the request row (status, `unitsAccepted`) and the response rows for this request. |
| **Screenshots** | Request details status card, donor-response counters. |

## T4: Set donor availability  *(FR04, UI-01)*

| | |
|---|---|
| **Precondition** | QA donor has a blood group on the profile. Starting state per pilot (see protocol): ideally **unavailable**. Session must start **before 18:00** local time (otherwise change the card time). |
| **Expected behaviour** | Home availability card → "Donor availability" (or Profile → availability) → switch on "Available to donate" → "Available until (optional)" → **Pick date & time** (Android: date dialog, then time dialog) → 18:00 → "Save availability" → toast "Availability saved". |
| **Success** | Availability is **available** and an **end time of 18:00 today** is saved (the chip shows e.g. "Mon, 14 Oct, 6:00 PM" before saving). If the app has no way to pick that exact time (web preview), mark the attempt *application-blocked / environment limitation*, do not mark it unaided. |
| **Common non-success** | Switch on but no end time (partial: record as failed against the criterion "with an end time"); choosing "2 hours" / "8 hours" instead of 6 pm (error unless it happens to equal 6 pm); not pressing "Save availability". |
| **Backend check** | Donor profile row: availability `available`, `availableUntil` ≈ today 18:00 local (stored in UTC; Sri Lanka is UTC+05:30, so 12:30 UTC). |
| **Screenshots** | Switch on with end time shown, saved toast. |

## T5: Respond to an alert  *(FR05, FR06, UI-05)*

| | |
|---|---|
| **Precondition** | A verified, synthetic request from **QA requester**, compatible with the QA donor's group and within the donor's radius, has produced a pending invitation. **Check the invitation exists on the donor's phone (Home "Asking for your help" or Alerts tab) before you start.** |
| **Expected behaviour** | Alerts tab (badge shows unread) or Home "Asking for your help" → "Emergency request" (blood group, units, hospital, distance, requester) → **Accept** → dialog "Accept this request?" → **"Yes, I'll donate"** → "You've accepted this request". |
| **Success** | The participant opens the **intended** request and completes Accept → "Yes, I'll donate". If a decoy request is present (optional), accepting the decoy fails the task. Declining fails the task. |
| **Common non-success** | Tapping Decline; stopping at the confirmation dialog ("Not yet"); opening Alerts but not the card. |
| **Backend check** | The donor's response row for the intended request is `accepted` and the request's accepted count increased by 1; the status moved on (e.g. partially fulfilled/fulfilled). |
| **Screenshots** | Alert/Home invitation, request details with Accept/Decline, confirmation dialog, outcome screen. |

## T6: Find history  *(FR10, UI-04)*

| | |
|---|---|
| **Precondition** | The QA donor has at least one past request record (e.g. the T2 request) so a "past record" exists. If none, the criterion cannot be met: log as application/data-blocked. Donation history will normally also be present after T5. |
| **Expected behaviour** | Home → Quick actions → **History**, or Profile → "Request & donation history" → History with tabs **Requests / Donations**. |
| **Success** | History screen open **and** the participant identifies one past record (reads out hospital, group or status of one row). |
| **Common non-success** | Searching the Requests tab only; opening notifications; unsure which tab is "history" (hesitation: record the first tap). |
| **Backend check** | Row the participant read exists in the donor's requests or donations. |
| **Screenshots** | History (Requests tab), History (Donations tab). |

---

## After every session: backend verification and reset (no deletions)

1. Record the final state of each task from the backend/reviewer view.
2. Cancel the participant's T2 request and the T5 alert request through the app ("Cancel this request"); nothing is deleted.
3. Set the QA donor back to the agreed starting availability.
4. Sign the phone out. Do not keep the card with credentials.
