# Implementation plan and status

Derived from `DONORLINK_MASTER_CLAUDE_COWORK_PROMPT.md`. Status is factual as of this commit.

## Phase 0: audit (done)

Kept: Expo SDK 57 project, `react-native-appwrite`, `.env` config, `expo-router`, `src/app` root, Reanimated/Gesture Handler.
Replaced: the template screens/components/assets (removed), the smoke-test home screen (the connection check now lives in Settings → Security).
Added: NativeWind v5, Tailwind v4, gluestack-ui v5 core/utils, Expo modules (secure-store, location, image/document picker, haptics, network, datetimepicker), fonts (Inter), test tooling.

## Phases

| # | Phase | Status |
| --- | --- | --- |
| 1 | Foundation: tokens, theme, NativeWind/gluestack, UI kit, app shell, branding assets | Done |
| 2 | Authentication: welcome, login, register, email code verification, password reset, session restore (secure store), route guards | Done |
| 3 | Onboarding (7 steps) and profile setup | Done |
| 4 | Requester: Home, create, review, matching, details, tracking, history | Done |
| 5 | Donor: availability, incoming accept/decline, coordination, history, donor details | Done |
| 6 | Organization: overview, verify queue, requests, donors, inventory, profile/team | Done |
| 7 | Platform/Admin: notifications, verification center, admin console, audit, analytics, support | Done |
| 8 | Realtime and backend hardening: function, permissions, transitions, notification logic | Done in code and tests; needs provisioning against the real project (see APPWRITE_SETUP.md) |
| 9 | UX polish: skeletons, empty/error states, animations, accessibility pass | Done for implemented screens (see below) |
| 10 | Testing and audit | Automated suites pass; end-to-end on a real device/backend pending provisioning |

## Milestone 02 usability findings and where they are addressed

| Finding | Solution |
| --- | --- |
| UI-01 donor availability not noticeable | `AvailabilityHero` high on Home: large word state, one-tap switch |
| UI-02 hard to compare distance/availability | `DonorCard`: blood group · distance · availability in one fixed row |
| UI-03 request status not noticed | `RequestStatusHero` + pulsing "Now" stage in the timeline |
| UI-04 navigation hesitation | Four fixed tabs; one header component; consistent back button |
| UI-05 Accept/Decline emphasis | Distinct success vs outline buttons, confirmation dialog, reason sheet, outcome screen |

## Deliberate deviations from the suggested structure

- Organization and admin screens live under `/org/*` and `/admin/*` (inside `(organization)` and `(admin)` groups) so their URLs cannot collide with the individual app's `/requests`, `/verification`, etc.
- The `matches` table was not created: matching is computed on demand server-side from `donor_profiles`, so a stored copy would only go stale.
- OS push notifications and Appwrite Messaging are not used; in-app Realtime alerts are.

## Remaining manual steps (cannot be done from the repository)

1. Create a provisioning API key and run `npm run appwrite:provision`.
2. Add the `admin` label to the first user.
3. Build a development build / run on an Android device to verify location, camera, file pickers and keychain storage on hardware.
