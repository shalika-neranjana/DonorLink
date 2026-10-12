# Architecture

## Layers

```
Screens (src/app, Expo Router)
   ↓ use
Hooks & providers (src/hooks, src/providers, src/features)
   ↓ call
Services (src/services)  ← typed, one per feature area
   ↓ use
Appwrite wrappers (src/lib/appwrite)
   ↓
Appwrite  ──►  Function `donorlink-api` (all privileged writes)
```

Screens never call Appwrite directly. Reads go `service → listRows/getRow`; writes go `service → callApi(action)`.

## Shared domain (`src/domain`)

Pure TypeScript with no React Native imports: blood groups and conventional compatibility, status vocabularies and labels, **transition tables**, timeline builder, validation, geo helpers, matching and scoring, role helpers, notification builders. It is used by the app **and** transpiled into the Appwrite Function (`appwrite/package-function.mjs`), so client-side checks and server-side enforcement can never disagree.

## Folder map

| Path | Contents |
| --- | --- |
| `src/app` | Routes only: `(auth)`, `(onboarding)`, `(app)/(tabs)`, `(organization)/org`, `(admin)/admin`, `gallery` (dev only) |
| `src/components/ui` | Design-system primitives (`DonorLink*`), built on gluestack core (modal, switch, toast, overlay) + NativeWind |
| `src/components/{blood,common,requests,matching,inventory,organizations,notifications,donors}` | Domain components (badges, cards, timeline, charts) |
| `src/features` | Feature state that spans screens: onboarding draft, request draft, organization context |
| `src/hooks` | `useResource` (server-state), realtime, form state, location, home data |
| `src/providers` | Auth, notifications (one realtime subscription), provider stack |
| `src/services` | `profile`, `request`, `matching`, `donor`, `donation`, `notification`, `verification`, `organization`, `admin`, `support` |
| `src/lib/appwrite` | client, config (all IDs), errors, auth + secure session, api (Function calls), database reads, realtime, private files |
| `src/theme` | colour tokens (`global.css` is the class-based source; `tokens.ts` the hex mirror; a test keeps them equal) |
| `appwrite/` | schema (single source), provisioning, function source + tests |

## Navigation

Expo Router with route guards (`Stack.Protected`) in the root layout:

```
signed out / verifying email → (auth)
signed in, onboarding incomplete → (onboarding)
signed in → (app): tabs Home · Requests · Alerts · Profile
              + requests/*, donor/*, history/*, verification/*, settings/*, hospitals/*, support
organization label → (organization)/org: Overview · Requests · Inventory · Donors · Organization
admin label → (admin)/admin: Overview · Users · Requests · Verify · More
```

Role groups are mounted only when the server-set label exists, so an ordinary user cannot open them even with a deep link. The organization and admin groups use the prefixes `/org` and `/admin` so their URLs never collide with the individual app.

Primary navigation is always four tabs with fixed labels and positions (Milestone 02 finding UI-04).

## State management

React state + context + small hooks. `useResource` is a deliberately minimal server-state hook (dedupes out-of-order responses, keeps stale data on failed refresh, reloads on focus, ends the session on expiry). Realtime (`useRealtimeRows`) triggers debounced reloads; every subscription is unsubscribed on unmount. No global store was added because none was needed.

## Request lifecycle

```
submitted → pending_verification → verified → matching → donors_contacted
          → partially_fulfilled → fulfilled → completed
(any active state) → cancelled | expired      pending_verification → rejected
```

Defined once in `src/domain/transitions.ts`. The function applies exactly these transitions, records each in `statusHistory`, notifies the right people and writes an audit entry. The tracking timeline (Submitted → Verified → Matching → Donors contacted → Response received → Blood secured → Completed) is derived from the same history.

Who does what:

1. Requester submits → `pending_verification` (or `verified` immediately when staff of a **verified** hospital, or an admin, submit).
2. Admin, or a member of the addressed hospital organization (never the requester), verifies → matching runs → the best N compatible, available donors are contacted.
3. A donor accepts or declines; acceptance creates a `donations` coordination row and moves the request to `partially_fulfilled` / `fulfilled`.
4. The requester, hospital staff or an admin confirms each donation (the donor cannot) → donor history and counters update → request `completed`.
5. A scheduled function expires stale requests.

## Matching (`src/domain/matching.ts`)

Hard filters: not the requester, conventionally compatible group, emergency alerts on, availability currently valid (not stale, not past "available until"), within both the donor's and the search radius. Ranking: exact group, distance, verification, self-reported recent donation (a deprioritisation, never a clinical exclusion). The result carries human-readable reasons; there is no percentage. Matching runs in the function so donors' coordinates and details never reach a requester's device; the client receives sanitised cards.

## Security model

- **Authentication**: Appwrite email/password. The session secret is stored in the device keychain (`expo-secure-store`) and re-applied on launch.
- **Authorization**: roles are Appwrite labels (`admin`, `organization`, `orgm<id>`) that only the function/console can set. Row permissions use those labels, the owner's user ID and per-donor read grants.
- **Never trusted from the client**: user ID, role, verification state, ownership, status. The function derives identity from the verified execution context.
- **Validation twice**: the same rules run in the app (fast feedback) and in the function (authoritative).
- **Privacy**: coordinates are coarsened to ~1 km before storage; other users see names like "Kasun P." and rounded distances; phone numbers and addresses are never exposed; documents live in private, encrypted, file-secured buckets and are previewed with the reviewer's session.
- **Audit**: important actions are written to `audit_logs` (admin-readable only).
- **No secrets in the app**: only public IDs ship. The provisioning API key lives in a git-ignored file and is deleted after use.

## Error, loading and offline states

`toAppError` converts Appwrite, function and network failures into plain-language messages with `retryable` / `sessionExpired` flags. Screens show skeletons while loading, retry-able error states, helpful empty states and an offline banner (`expo-network`). Actions disable themselves while in flight; request creation also carries an idempotency key so a double tap or a retry can never create two requests.

## Testing

| Suite | What it proves |
| --- | --- |
| `src/domain/__tests__` | validation, compatibility, matching/exclusions/ranking, transition tables, timeline, role rules, notifications |
| `appwrite/functions/api/__tests__` | full request → verify → match → accept → confirm lifecycle, cancellation cascade, expiry, org workflows, inventory, verification, support, analytics, and authorization/ownership/role checks, against an in-memory Appwrite stand-in |
| `src/__tests__/screens` | key screens render and behave (accept/decline confirmation, validation messages, empty states) with mocked services |
| `src/__tests__/consistency.test.ts` | schema enums = app enums, every client API call exists in the function, design tokens in sync, WCAG AA contrast |
