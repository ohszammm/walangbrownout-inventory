---

## QA Documentation

The Quality Assurance (QA) documentation for the WalangBrownout Inventory Management System is located in the `docs/` directory.

| Document | Description |
|---|---|
| `docs/qa-summary.md` | Summarizes the QA objectives, testing scope, test execution status, and next steps. |
| `docs/test-cases.md` | Contains test scenarios, test steps, expected results, and test execution records. |
| `docs/bug-reports.md` | Provides a template and tracking log for recording confirmed defects, their severity, and their status. |
| `docs/user-guide.md` | Provides instructions for the system's user roles and main workflows. |

### QA Testing Status

**Status: In Progress**

The QA documentation has been prepared. Actual test execution and verification of results must be completed before the overall QA status can be marked as completed.

- **API test command:** `npm run test:api`
- **Test source directory:** `tests/`
- **QA documentation directory:** `docs/`

### Important Notes

- Record test results only after executing the corresponding test cases.
- Report bugs only when an issue has been observed and documented with sufficient evidence.
- Verify the application behavior against the actual running system before finalizing the user guide.
- Use `php artisan migrate:fresh --seed` only with an appropriate test or development database because it deletes existing tables and reloads the seed data.

