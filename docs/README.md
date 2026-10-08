# DonorLink documentation

| Document | What it covers |
| --- | --- |
| [setup-appwrite.md](setup-appwrite.md) | Appwrite project setup, provisioning, permissions and remaining manual steps |
| [architecture.md](architecture.md) | App layers, folder structure and security model |
| [database-schema.md](database-schema.md) | Tables, columns and indexes (generated, see below) |
| [implementation-plan.md](implementation-plan.md) | Delivery phases and current status |
| [qa-report.md](qa-report.md) | QA audit and test report |
| [qa-test-matrix.md](qa-test-matrix.md) | Test case matrix for the QA audit |

`database-schema.md` is generated from `appwrite/schema.mjs`. Do not edit it by hand; run:

```bash
npm run docs:schema
```

For the project overview and quick start, see the [root README](../README.md). For workflow and conventions, see [CONTRIBUTING.md](../CONTRIBUTING.md).
