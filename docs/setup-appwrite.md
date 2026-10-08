# Appwrite setup

Project: **DonorLink** · ID `6ac4b77b003a7479e081` · endpoint `https://sgp.cloud.appwrite.io/v1` · Android package `com.donorlink.app`.

The app talks to Appwrite directly for **reads and realtime**, and through one Appwrite Function (`donorlink-api`) for **all privileged writes**. Nothing here puts a secret in the mobile app.

## 1. Environment (already done)

`.env` holds only public identifiers:

```
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=6ac4b77b003a7479e081
EXPO_PUBLIC_APPWRITE_PLATFORM=com.donorlink.app
EXPO_PUBLIC_APPWRITE_DATABASE_ID=donorlink
EXPO_PUBLIC_APPWRITE_FUNCTION_ID=donorlink-api
```

The database and function IDs above are the IDs the provisioning script **creates**. They do not exist in your project until step 3 has run.

## 2. ACTION REQUIRED: create a provisioning API key

1. Open the **Appwrite Console** → project **DonorLink** → **Overview → Integrations → API keys** → **Create API key**.
2. Name it `provisioning`. Choose an expiry (e.g. 1 day).
3. Scopes: select **all** (the script creates databases, tables, columns, indexes, buckets, functions, variables and deployments).
4. Copy the secret and put it in a new file `.env.provision.local` in the project root (git-ignored):

   ```
   APPWRITE_API_KEY=standard_xxxxxxxxxxxxxxxx
   ```

5. **Delete the key in the console** when provisioning has finished. It is never needed by the app or the function.

## 3. Provision the backend

```bash
npm run appwrite:provision
```

It is idempotent (safe to re-run) and never deletes anything. It creates:

- database `donorlink` with 13 tables, columns, enums and indexes (see [database-schema.md](database-schema.md));
- one private bucket `files` for profile photos and verification documents (file security on, 5 MB, jpg/png/webp/pdf, encrypted; the free Appwrite plan allows only one bucket);
- seed rows: `system_settings/global` and a directory of real Sri Lankan public hospitals as **unclaimed, unverified** listings;
- function `donorlink-api` (Node 22, scheduled every 15 minutes for maintenance, execute permission `users`) with its scopes, then packages and deploys it.

Column creation is asynchronous in Appwrite; the script waits for each table to become available, so the first run takes a few minutes.

If the function build fails, open **Functions → DonorLink API → Deployments** in the console to read the build log.

## 4. ACTION REQUIRED: register the web platform (only for browser testing)

Mobile builds identify as `com.donorlink.app`, which is already registered. To try the app in a browser (`npx expo start --web`), add a **Web** platform for hostname `localhost` in **Overview → Integrations → Platforms**.

## 5. ACTION REQUIRED: create the first administrator

1. Run the app and register an account.
2. Console → **Auth → Users →** your user → **Labels** → add `admin`.
3. Sign out and in again. **Profile → Admin console** appears.

From then on administrators grant admin access in-app (**Admin → Users**) and approve organizations (**Admin → Verify**). Never store roles anywhere a user can edit them: roles are Appwrite labels set only by the function or the console.

## 6. Email (verification and password reset)

The app uses 6-digit email codes, so no redirect pages are needed. Appwrite Cloud sends them by default. Customise the email templates in **Auth → Settings → Templates** if you want branded messages.

## How the Function authenticates

- Callers are verified by Appwrite; the function reads the trusted `x-appwrite-user-id` header and loads the user (including **labels**) with its per-execution dynamic API key. Anything role-like in the request body is ignored.
- Every action validates input again with the same TypeScript rules the app uses (`src/domain`, transpiled into the function bundle by `appwrite/package-function.mjs`).
- Status changes go through one transition table; invalid moves return HTTP 409 with a readable message.

## Permissions summary

| Data | Who can read | Who can write |
| --- | --- | --- |
| profiles, donor_profiles | the user, admins | function only |
| blood_requests | requester, addressed hospital's members, contacted donors, admins | function only |
| request_responses, donations | donor, requester, hospital members, admins | function only |
| organizations (directory), system_settings | any signed-in user | function only |
| organization_members, blood_inventory | that organization's members, admins | function only |
| notifications | the recipient | function creates; recipient may mark read / delete |
| verifications, support_tickets | the submitter, admins | function only |
| audit_logs | admins | function only |
| files bucket (photos, documents) | the uploader, admins | the uploader creates; deletes own |

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| App shows "We couldn't open DonorLink" | `.env` missing or the device can't reach the endpoint |
| Actions fail with "DonorLink is having trouble" | Function not deployed, or build failed (check Deployments) |
| `unauthorized` after sign-in | Session expired; sign in again |
| No admin console | `admin` label missing, or you haven't signed out and in again |
| Provision script: `401` / `scope` errors | API key missing scopes or `APPWRITE_API_KEY` not set |
