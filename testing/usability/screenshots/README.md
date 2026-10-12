# Screenshots

| Folder | Content | Status |
|---|---|---|
| `automated-tests/` | Captured by the Playwright suite (web preview, 390 × 844) | **10 screenshots, signed-out screens only** (see `../results/screenshot-register.csv`) |
| `application/` | Signed-in application states captured by hand or by the credentialed E2E | Empty: needs QA sign-in by the project owner |
| `task-evidence/` | T1-T6 evidence from participant sessions (`Pnn_Tn_description.png`) | Empty: needs real sessions and consent |
| `issues/` | Evidence for logged issues (`WA-nn_description.png`) | Empty |
| `annotated/` | Annotated copies; originals are never edited | Empty |

Rules: synthetic data only; no passwords, tokens, faces, names or real medical details; participant-session shots need consent; never edit or generate a screenshot to look successful; list every file in `../results/screenshot-register.csv`. The credentialed E2E (`qa-e2e.pw.ts`) writes its `T1_…`-`T6_…` and `TC-E2E-U…` shots into `automated-tests/` when it is run.
