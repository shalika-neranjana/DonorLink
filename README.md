# DonorLink

**Blood Donor–Recipient Matching and Emergency Blood Request App**
SLIIT · IT3060 Human Computer Interaction · Group Y3S2.IT.WE_02

DonorLink brings emergency blood requests, donor matching, verification and request tracking into one mobile app, replacing the mix of social media posts, WhatsApp groups and phone calls people rely on today. The design follows the Milestone 02 prototype and fixes the problems found in its usability testing.

> DonorLink is a **coordination** tool. It does not diagnose, approve donors or decide transfusion compatibility. *Final blood compatibility and donation eligibility must be confirmed by qualified healthcare professionals.*

## Features

| Role | What you can do |
| --- | --- |
| **Everyone** | Sign up with email-code verification, reset password, guided onboarding, Home / Requests / Alerts / Profile tabs, history, hospital directory, support & FAQ, identity/donor/organization verification |
| **Requester** | One-page emergency request → review → submit → matching donors → details → live tracking timeline; cancel, close, confirm donations |
| **Donor** | Availability control on Home, Accept / Decline with confirmation, donation coordination, donation history |
| **Organization** | Verify requests for your hospital, coordinate donors, manage blood inventory with low-stock alerts, manage your team |
| **Admin** | Users, request and verification review, organizations, inventory oversight, analytics, audit log, support tickets, platform settings |

## Tech stack

React Native · Expo SDK 57 · TypeScript · Expo Router · Appwrite (Auth, TablesDB, Storage, Functions, Realtime) · gluestack-ui v5 · NativeWind v5 / Tailwind CSS v4 · Reanimated · Gesture Handler.

---

## Quick start (about 15 minutes)

### 1. Prerequisites

- **Node.js 20 or newer** and npm (`node -v`)
- **Git**
- An **Appwrite account** ([cloud.appwrite.io](https://cloud.appwrite.io), free plan is enough)
- For running the app: an **Android phone or emulator**, or an iPhone (see step 5)

### 2. Get the code

```bash
git clone <your-repository-url> DonorLink
cd DonorLink
npm install
```

### 3. Create your own Appwrite project

1. In the Appwrite Console, **create a project** (any name, e.g. `DonorLink`).
2. Open **Overview → Integrations → Platforms → Add platform → Android** and use the package name `com.donorlink.app`. (For iOS use the same value as bundle ID. For browser testing add a **Web** platform with hostname `localhost`.)
3. Copy the **Project ID** and the **API endpoint** (shown on the Overview page, e.g. `https://fra.cloud.appwrite.io/v1`).

Create the file `.env` in the project root:

```ini
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://<region>.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=<your project id>
EXPO_PUBLIC_APPWRITE_PLATFORM=com.donorlink.app
EXPO_PUBLIC_APPWRITE_DATABASE_ID=donorlink
EXPO_PUBLIC_APPWRITE_FUNCTION_ID=donorlink-api
```

These are public identifiers, safe to keep in the app. `.env.example` shows the same template.

### 4. Provision the backend (one command)

DonorLink needs a database, tables, a storage bucket and one server function. A script creates all of it.

1. In the Console go to **Overview → Integrations → API keys → Create API key**. Name it `provisioning`, set a short expiry, tick **all scopes**.
2. Create a file `.env.provision.local` in the project root (it is git-ignored):

   ```ini
   APPWRITE_API_KEY=<the secret you just copied>
   ```
3. Run:

   ```bash
   npm run appwrite:provision
   ```

   It takes a few minutes (Appwrite builds columns and the function asynchronously). It is safe to re-run; it only adds what is missing and never deletes anything.
4. **Delete the API key in the Console.** It is not needed again, and it is never shipped in the app.

When it finishes you will see `Done`. If the function build fails, open **Functions → DonorLink API → Deployments** in the console for the build log.

### 5. Run the app

```bash
npx expo start
```

- **Android emulator:** press `a`.
- **Physical Android/iPhone:** install a development build, or use Expo Go if it supports SDK 57 on your device, and scan the QR code.
- **Browser (preview only):** press `w` (needs the Web platform from step 3).

Your phone and computer must be on the same network for the QR code to work.

### 6. Create the first administrator

1. Register an account in the app (verify the 6-digit code that arrives by email, or choose "Verify later").
2. In the Console open **Auth → Users →** your user **→ Labels** and add the label `admin`.
3. Fully close and reopen the app. **Profile → Admin console** now appears.

From there admins can promote other admins, approve organizations and review verification documents.

### Try the whole flow

1. **Account A** (donor): finish onboarding with a blood group, open **Profile → Donor availability** and switch on *Available*.
2. **Account B** (requester): **Home → Request blood**, review and submit. The request waits for verification.
3. **Admin**: **Admin console → Requests → Pending**, open the request and press **Verify**.
4. **Account A** receives an alert, opens the request and presses **Accept**.
5. **Account B** watches **Request tracking** update live and confirms the donation when it happens.

---

## Everyday commands

| Command | Purpose |
| --- | --- |
| `npx expo start` | Start the dev server |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm test` | All tests (domain rules, backend workflows, screens, consistency) |
| `npm run appwrite:provision` | Create/update the backend (idempotent) |
| `npm run docs:schema` | Regenerate `DATABASE_SCHEMA.md` |

During development a component gallery is available at `/gallery` (not in production builds).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| "We couldn't open DonorLink" on launch | `.env` missing or wrong; restart `npx expo start` after editing it |
| Provisioning says `401` / scope error | API key missing scopes, or `APPWRITE_API_KEY` not set in `.env.provision.local` |
| Provisioning says bucket/plan limit reached | The free plan allows one bucket; DonorLink uses exactly one (`files`) |
| Actions fail with "DonorLink is having trouble" | Function not deployed or build failed; check Deployments in the console, then re-run provisioning |
| No admin console after adding the label | Fully restart the app so the user is reloaded |
| Verification email doesn't arrive | Check spam; on self-hosted Appwrite configure SMTP |
| Browser preview can't reach Appwrite | Add a Web platform for hostname `localhost` |
| Metro errors after changing `metro.config.js` | Stop and restart `npx expo start` (add `--clear` if needed) |

## Known limits

- Alerts are **in-app** (live via Appwrite Realtime). OS push notifications are not implemented.
- Matching is application-level ranking (blood group, availability, distance, verification), not a clinical decision.
- Not yet verified on physical devices: camera, location and file-upload behaviour.

## Documentation

- [APPWRITE_SETUP.md](APPWRITE_SETUP.md): backend setup details and permissions
- [ARCHITECTURE.md](ARCHITECTURE.md): layers, folders, security model
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md): generated tables and columns
- [CONTRIBUTING.md](CONTRIBUTING.md): workflow, branches, member ownership
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): phases and status
