# Bug Reports
## WalangBrownout Inventory Management System

**Prepared by:** QA and Documentation Lead  
**Project:** WalangBrownout Inventory Management System  
**Purpose:** To document, track, and verify software defects discovered during testing.

## 1. Purpose

This document provides a standard format for recording bugs found during manual or automated testing. Each report should contain enough information for the development team to understand, reproduce, and investigate the issue.

**Note:** No confirmed bugs are listed yet. Bug entries should be added only after an issue has been observed during testing.

## 2. Bug Report Template

Use the following template for every confirmed issue.

### Bug ID: BUG-001

- **Title:** [Short description of the issue]
- **Date Reported:** [YYYY-MM-DD]
- **Reported By:** [Name or team role]
- **Related Test Case:** [TC-01 to TC-12, if applicable]
- **Module:** [Authentication / Inventory / Warehouse / Purchasing / Sales / Reports]
- **Severity:** [Critical / High / Medium / Low]
- **Priority:** [High / Medium / Low]
- **Environment:** [Browser, operating system, server, and test environment]
- **Status:** Open
- **Assigned To:** [Developer or team, if known]

**Description**

[Explain what happened and why it appears to be a defect.]

**Preconditions**

[List any required account, role, data, or system state.]

**Steps to Reproduce**

1. [First action]
2. [Second action]
3. [Continue until the issue occurs]

**Expected Result**

[Describe what should happen according to the requirements or test case.]

**Actual Result**

[Describe what actually happened.]

**Evidence**

[Attach a screenshot, error message, response, or relevant log when available.]

**Resolution**

[Complete after the development team fixes or otherwise resolves the issue.]

**Retest Result**

[Not yet tested / Pass / Fail]

## 3. Severity Definitions

| Severity | Description |
|---|---|
| Critical | A major system failure or serious data/security issue that prevents essential operations |
| High | A major feature is unusable or an important workflow is significantly affected |
| Medium | A feature works incorrectly, but a workaround may be available |
| Low | A minor issue with limited impact, such as a display or wording problem |

## 4. Priority Definitions

| Priority | Description |
|---|---|
| High | Should be addressed as soon as practical because of its impact on important operations |
| Medium | Should be addressed during normal bug-fixing work |
| Low | Can be scheduled after more important issues |

Severity describes the impact of a defect; priority describes how urgently it should be addressed.

## 5. Bug Tracking Log

Add an entry only when an issue has actually been observed.

| Bug ID | Title | Related Test Case | Severity | Priority | Status |
|---|---|---|---|---|---|
| No confirmed bugs recorded | — | — | — | — | Not applicable |

## 6. Bug Lifecycle

1. **Open:** The issue has been reported and needs investigation.
2. **In Progress:** The development team is investigating or fixing the issue.
3. **Fixed:** A proposed fix has been completed and is ready for retesting.
4. **Retest:** QA is checking whether the fix resolves the issue.
5. **Closed:** QA has verified the fix and the issue is resolved.
6. **Reopened:** The issue still occurs or returns after a proposed fix.

## 7. Retesting Guidelines

After a fix is provided:

1. Repeat the original reproduction steps.
2. Compare the actual result with the expected result.
3. Check related functionality for unintended side effects.
4. Record the retest result and evidence.
5. Close the bug only when the fix is verified.

If the issue persists, record the new evidence and reopen the report.

## 8. QA Notes

- Do not report an issue as confirmed without evidence or reproducible behavior.
- Do not mark a bug as fixed solely because code changes were made.
- Keep test results and bug status consistent.
- Avoid including passwords, private user information, or other sensitive data in screenshots and logs.
- Link bugs to the relevant test case whenever possible.
