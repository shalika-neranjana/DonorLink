# Results

| Path | Content | Executed? |
|---|---|---|
| `automated/00-environment.json` | Read-only environment record (no secrets) | Yes, 12 Oct 2026 |
| `automated/01-typecheck.log` | `npm run typecheck` | Yes: pass |
| `automated/02-lint.log` | `npm run lint` | Yes: pass |
| `automated/03-jest.log`, `03-jest-report.json` | `npm test`: 9 suites, 122 tests | Yes: pass |
| `automated/04-playwright.log`, `04-playwright-report.json` | `public-screens.pw.ts` (10 pass) + `qa-e2e.pw.ts` (8 skipped, no credentials) | Yes |
| `screenshot-register.csv` | Register of all screenshots | 10 rows (automated tests) |
| `private/` | **Git-ignored.** Raw participant sheets, recordings, pilot notes | Empty |

There are **no participant results** in this folder. When sessions are run, keep raw sheets and recordings in `private/Pnn/`, put anonymised summaries in the workbooks, and never commit credentials or recordings.
