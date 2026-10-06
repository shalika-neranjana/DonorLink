# Contributing

## Workflow

```
main        stable, demonstrable
develop     integration branch (current working branch in this repo: `development`)
feature/*   one branch per area below
```

1. Branch from `develop`: `feature/requester`, `feature/donor`, `feature/organization`, `feature/admin`, `feature/auth`, `feature/design-system`.
2. Small, meaningful commits, Conventional-Commit style:
   `feat(requests): add emergency request creation`, `fix(requests): prevent duplicate submission`, `refactor(appwrite): centralize database services`.
3. Before opening a pull request: `npm run typecheck && npm run lint && npm test`.
4. Another member reviews. Shared files (design system, `src/domain`, `appwrite/schema.mjs`) need review from all four members.
5. **Never commit secrets.** `.env` holds public IDs only. `.env.provision.local` and any `APPWRITE_API_KEY` stay local.

## Member ownership

Four vertical areas of equal scope. Shared: design system, shared UI components, code review, integration testing, documentation.

| Member | Area | Owns |
| --- | --- | --- |
| **1** | Requester & Emergency Requests | `src/app/(app)/requests/*`, `(tabs)/requests`, `(tabs)/index` (requester parts), `src/features/requester`, `components/requests`, `services/requestService`, request validation in `domain`, `appwrite/.../handlers/request.js`, requester history |
| **2** | Donor & Matching | `src/app/(app)/donor/*`, `components/matching`, `components/donors`, `domain/matching.ts`, `services/donorService`, `services/matchingService`, `handlers/response.js`, donor history |
| **3** | Hospital / Organization & Inventory | `src/app/(organization)/*`, `src/features/organization`, `components/inventory`, `components/organizations`, `services/organizationService`, `handlers/organization.js`, `handlers/donation.js` (coordination) |
| **4** | Platform, Administration & Notifications | `src/app/(auth)`, `(onboarding)`, `(admin)`, `(tabs)/notifications`, `(tabs)/profile`, `verification/*`, `settings/*`, `src/providers`, `services/{admin,verification,notification,support,profile}Service`, `appwrite/*` (schema, provisioning, function platform/admin/verification handlers), security rules |

## Adding a feature

1. Add or extend the **domain** rule (`src/domain`) and its unit test first.
2. If it changes data: edit `appwrite/schema.mjs`, run `npm run docs:schema`, re-run `npm run appwrite:provision` (additive and idempotent).
3. Add the **function action** in `appwrite/functions/api/src/handlers` and register it in `handlers/index.js`; add a workflow test using the in-memory backend.
4. Add the **service method** in `src/services` (typed) and a hook if state is shared.
5. Build the screen with design-system components only (`src/components/ui`). Provide loading, empty, error and offline states. Check it in `/gallery` if you added a component.
6. Update docs only for things that exist.

## Design rules

- One obvious primary action per screen. Emergency red is semantic (urgent states, the Request-blood action); don't decorate with it.
- Colour tokens only (`bg-primary`, `text-fg-secondary`…); never raw hex in screens.
- Status is never colour-only: use `*Badge` components (text + icon).
- Touch targets ≥ 48 px; text through `DonorLinkText`; icons through `DonorLinkIcon`.
- Anything medical-sounding must carry the disclaimer (`MedicalDisclaimer`).

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run appwrite:provision
npm run docs:schema
npx expo start
```

## Testing checklist for a pull request

- Domain/unit tests for new rules
- Function workflow test when behaviour or permissions change
- Screen test for non-trivial flows
- Manual: small phone, large font scale, dark mode, airplane mode (offline banner + retry), denied location permission
