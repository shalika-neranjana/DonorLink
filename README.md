# DonorLink

**Blood Donor–Recipient Matching and Emergency Blood Request App**
SLIIT · IT3060 Human Computer Interaction · Group Y3S2.IT.WE_02

DonorLink brings emergency blood requests, donor matching, verification, communication and request tracking into one app, replacing the mix of social media posts, WhatsApp groups and phone calls that people rely on today (Milestone 01 research). The design follows the Milestone 02 high-fidelity prototype and fixes the problems found in its usability testing.

> DonorLink is a **coordination** tool. It does not diagnose, approve donors or decide transfusion compatibility. *Final blood compatibility and donation eligibility must be confirmed by qualified healthcare professionals.*

## What it does

| Area | Features |
| --- | --- |
| **Everyone** | Email sign-up with 6-digit email verification, password reset, onboarding (profile, blood group, location, preferences), Home, Requests, Alerts, Profile tabs, request & donation history, hospital directory, support & FAQ, verification center (identity, donor, organization) |
| **Requester** | One-page emergency request → review → submit → matching donors → request details → live tracking timeline; cancel, close, confirm donations |
| **Donor** | Prominent availability control, incoming request with distinct Accept / Decline, donation coordination (directions, hospital contact, withdraw), donation history |
| **Organization** | Own workspace: overview, verify requests addressed to the hospital, coordinate donors (schedule, message, confirm), blood inventory with low-stock states, team management |
| **Admin** | Console: platform overview, users, requests, verification review (with private document preview), organizations/directory, inventory oversight, analytics, audit log, support tickets, platform settings |

Matching is transparent: a donor card always shows blood group, approximate distance and availability side by side, and a "Why this donor" card lists the reasons behind the quality label (no fake percentages).

## Tech stack

React Native · Expo SDK 57 · TypeScript · Expo Router · Appwrite (Auth, TablesDB, Storage, Functions, Realtime) · gluestack-ui v5 (`@gluestack-ui/core` + `@gluestack-ui/utils`) · NativeWind v5 / Tailwind CSS v4 · React Native Reanimated · React Native Gesture Handler.

## Getting started

```bash
npm install
# .env already contains the public Appwrite IDs (see .env.example / APPWRITE_SETUP.md)
npx expo start              # press a for Android, or scan the QR with a development build
```

**The backend must be provisioned once** (database, tables, storage, function). Follow [APPWRITE_SETUP.md](APPWRITE_SETUP.md) — it is one command after you create an API key.

### Commands

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint (`expo lint`) |
| `npm test` | Jest: domain rules, function workflows, screens, schema/design-token consistency |
| `npm run appwrite:provision` | Create/update the Appwrite backend (idempotent) |
| `npm run appwrite:package-function` | Build the function bundle without deploying |
| `npm run docs:schema` | Regenerate `DATABASE_SCHEMA.md` from `appwrite/schema.mjs` |

In development a component gallery is available at `/gallery` (not included in production builds).

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md): layers, folders, data flow, security model
- [APPWRITE_SETUP.md](APPWRITE_SETUP.md): provisioning and manual steps
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md): generated tables, columns, permissions
- [CONTRIBUTING.md](CONTRIBUTING.md): workflow, branches, member ownership, testing
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): phases and status
- [AGENTS.md](AGENTS.md): Expo conventions for this repo

## Status and known limits

- Alerts are **in-app** (Appwrite Realtime keeps the badge and lists live, with an in-app banner for new alerts). OS-level push notifications are not implemented; they need FCM/APNs credentials and a development build.
- Email delivery (verification and recovery codes) uses Appwrite's mail service; on Appwrite Cloud this works out of the box, self-hosted projects need SMTP.
- The first administrator is created by adding the `admin` label to a user in the Appwrite Console (see setup guide).
- Backend logic is verified by automated tests against an in-memory Appwrite stand-in; an end-to-end run against a real Appwrite project requires completing the setup guide first.
