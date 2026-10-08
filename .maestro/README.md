# DonorLink E2E (Maestro)

Status: **NOT EXECUTED.** These flows were written during the 2026-10-09 QA
audit from the real screen text and accessibility labels, but no emulator,
development build or approved test accounts were available, so none has run.
Treat a first run as flow debugging, not as a verdict on the app.

## What is covered

| Flow | Test ID | Who |
| --- | --- | --- |
| 01-login-logout | TC-AUTH-020 | requester |
| 02-requester-creates-request | TC-PATIENT-020 | requester |
| 03-admin-verifies-request | TC-ADMIN-020 | admin |
| 04-donor-accepts | TC-DONOR-020 | donor (O+ or O-, available, Colombo) |
| 05-requester-sees-update | TC-PATIENT-021 | requester |
| 06-donor-declines (tag `manual`) | TC-DONOR-021 | second donor |

Run them in order: 02 → 03 → 04 → 05 form one end-to-end story.

## Setup

1. Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro
2. Build and install a development build on an Android emulator
   (`npx expo run:android`, or `eas build --profile development`).
   Expo Go also works if it supports SDK 57 on your device.
3. Create **dedicated QA accounts** in your Appwrite project (never real users):
   requester, donor (blood group O+ with availability switched on), admin (label
   `admin`), and optionally a second donor. Do not commit their passwords.
4. Run, passing credentials as environment variables:

```bash
maestro test .maestro -e REQUESTER_EMAIL=qa.requester@example.com -e REQUESTER_PASSWORD=... -e ADMIN_EMAIL=... -e ADMIN_PASSWORD=... -e DONOR_EMAIL=... -e DONOR_PASSWORD=...
```

The flows create real rows in whatever Appwrite project the build points at.
Use a separate QA project, or cancel the test requests afterwards.
