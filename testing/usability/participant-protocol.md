# Facilitator protocol (one session, about 20 minutes)

Roles: **facilitator** (talks to the participant, reads cards) and **note-taker** (times, counts, writes observations, operates the reviewer account). One person may do both only if the session is recorded with consent; say so on the sheet.

Never lead. Never name a screen, button or tab. Never say "good" or "wrong". The participant can stop at any time without giving a reason.

## 0. One-off preparation (before the first participant)

1. Read `test-plan.md` §3 (decisions D1-D9) and `test-data/synthetic-data.md`.
2. Get an Android phone with the DonorLink build installed (report: `npx eas-cli build -p android --profile preview`). Record device, OS, build ID/commit.
3. Confirm the three QA accounts work (owner types the passwords; nothing is written in the repository).
4. Run `node scripts/check-environment.mjs`.
5. **Pilot (does not count as a participant):** a team member runs T1-T6 once. Answer these questions and write the answers in `results/private/pilot-notes.md`:
   * Does the T5 invitation still appear and can it be accepted when the donor is *unavailable*? (decides the T4 starting state)
   * How long after verification does the invitation arrive?
   * Does T4 offer 18:00 on the phone's picker?
   * Is the T2 request visible in Requests after submit?
6. Print: consent script, task cards, SEQ card, SUS form, debrief sheet, recording sheet (or open `observation-sheet.xlsx`).

## 1. Before each session (reset checklist, about 10 minutes)

| # | Step | Done |
|---|---|---|
| 1 | Session starts **before 18:00** local time (or note the changed T4 time) | ☐ |
| 2 | Phone: signed out, DonorLink open on Welcome, notifications on, brightness up, "do not disturb" off | ☐ |
| 3 | Previous test requests (`ZZ USABILITY TEST HOSPITAL`) cancelled in the app; nothing deleted | ☐ |
| 4 | QA donor availability set to the agreed starting state (from the pilot) | ☐ |
| 5 | QA requester creates a **synthetic alert request** (group compatible with the donor, hospital `ZZ USABILITY TEST HOSPITAL`, district within the donor's radius, notes "USABILITY TEST") and QA reviewer **verifies** it (C.3) | ☐ |
| 6 | The donor's phone shows the invitation (Home "Asking for your help" or Alerts). If not, repeat 5. **Do not hand over the phone without it** | ☐ |
| 7 | Screen recording set up **only if** the participant will consent | ☐ |
| 8 | Reviewer account open on a second device/browser (for T2 → T3 verification) | ☐ |
| 9 | Sessions sheet row created: ID, date, environment, device, build | ☐ |

## 2. Welcome and consent (3 min)

Read the script in `participant-introduction.md`. Ask the two consent questions separately and record them (ID, consent yes/no, recording consent yes/no, date). If either "no": continue without that item; if they decline taking part, thank them and stop; **delete no records, simply do not use the row** (Eligibility column shows NO CONSENT).

Collect the profile (no identifying data): age band, smartphone use, donated Y/N, searched for blood for someone Y/N, used the M02 prototype Y/N (`questionnaires/participant-profile.md`).

Think-aloud: *"Please say what you are looking at, what you are trying, and what you expect to happen. I won't answer questions about how to do it during the tasks, but I'll note them."* Do a 20-second warm-up (e.g. "say aloud what you can see on this screen").

## 3. Tasks (about 11 min including SEQ)

For each of T1…T6 in order:

1. Hand over the card; read it aloud; **start timer when you finish reading**.
2. Note-taker records: first tap, errors, recoveries, hesitation, quotes, anything odd about the app.
3. Hint rule: stuck 60 s or asked twice → one neutral hint → *assist*. After 3 min → *abandoned*, move on.
4. At the success state stop the timer. Ask the **SEQ** (1-7).
5. Note the outcome on the sheet and take a screenshot **only if** the participant consented to screenshots/recording and the screen shows synthetic data.

Special steps:

* **After T2:** while the participant gives the SEQ, the note-taker opens the request in the reviewer account, **records ground truth** (status badge, Contacted/Accepted/Waiting/Declined), and verifies it (so the app has something to report in T3). Note the time of verification.
* **Before T3:** check the participant's phone still shows the request; don't tell them where.
* **Before T4:** if the clock is past 18:00, change the card time and record it.
* **Before T5:** confirm the alert is still pending.

## 4. SUS (3 min)

Give the 10-item SUS (`questionnaires/sus.md`). Say: *"Go with your first reaction; there are no right answers."* Do not help interpret items. Enter answers in the `SUS` sheet.

## 5. Debrief (3 min)

Ask the four questions in `questionnaires/debrief.md`; write short answers and quotes verbatim. Ask whether anything else surprised them. Thank the participant.

## 6. After each session (5 min, no deletions)

1. Backend/reviewer check of each task's state (see `task-success-criteria.md`).
2. Cancel the participant's T2 request and the T5 alert request in the app.
3. Reset donor availability to the starting state. Sign the phone out.
4. Rename any screenshots/recordings `Pnn_Tn_description.ext`; store them in `results/private/Pnn/` (git-ignored; not committed) and list shareable ones in `results/screenshot-register.csv`.
5. Complete the Observations and SUS rows. Log issues (`WA-nn`) in `issue-log.xlsx`.

## 7. After the last session

1. Copy `Sessions`, `Observations`, `SUS` (values) into `results-analysis.xlsx` and the `Issues` sheet from `issue-log.xlsx`.
2. Check the Summary recruitment line (5-8 participants, ≥ 2 donors, ≥ 2 searchers, 0 group members).
3. Fill the report's Table 16 from the `Table 16` sheet; add new issues to Section 10.
4. Report counts with the small-sample caveat. Any task or recruitment target not met is stated as not met.
