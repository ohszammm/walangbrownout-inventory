# QA Test Cases
## WalangBrownout Inventory Management System

**Prepared by:** Jan Cedric T. Nuqui  
**Role:** QA and Documentation Lead  
**System:** WalangBrownout Inventory Management System  
**Test Type:** API and Functional Testing

## 1. Purpose

This document describes the test cases derived from the existing automated API tests in `tests/api.test.mjs`. The tests cover authentication, role permissions, inventory operations, purchasing, warehouse workflows, dashboards, validation, and reorder calculations.

The expected results below are based on the assertions defined in the test source code. They do not, by themselves, confirm that the tests have been executed successfully.

## 2. Test Environment

- Backend: Laravel
- API prefix: `/api`
- Test script: `npm run test:api`
- Default API base URL: `http://127.0.0.1:8000/api`
- Database: A freshly migrated and seeded database
- Server: Laravel development server

Before running the API tests, prepare the database and start the server in a separate terminal:

```bash
php artisan migrate:fresh --seed
php artisan serve
```

Then run the tests in another terminal:

```bash
npm run test:api
```

Warning: `php artisan migrate:fresh --seed` resets the database. Use only an appropriate development or test database, never a database containing important data.

## 3. Test Cases

### TC-01: Authentication and Session Management

Objective: Verify login behavior, account restrictions, and session handling.

Test Steps:
1. Request the dashboard without logging in.
2. Attempt to log in with an incorrect password.
3. Attempt to log in using a disabled account.
4. Attempt to log in using an account awaiting approval.
5. Log in using the administrator account.
6. Retrieve the authenticated user's information.
7. Log out and request the dashboard again.

Expected Results:
- Unauthenticated dashboard access returns HTTP 401.
- Incorrect credentials return HTTP 401.
- Disabled and pending accounts return HTTP 403.
- Valid administrator login succeeds.
- The authenticated user's role is returned.
- The user response does not expose the password.
- After logout, dashboard access returns HTTP 401.

### TC-02: Login Lockout and Administrator Unlock

Objective: Verify protection against repeated failed login attempts.

Test Steps:
1. Submit five login attempts with incorrect passwords for the sales account.
2. Attempt to log in using the correct password.
3. Use the administrator account to reactivate the affected account.
4. Attempt login again using the correct password.

Expected Results:
- Login after repeated failures returns HTTP 429.
- The administrator can update the account status successfully.
- Login succeeds after the account is unlocked.

### TC-03: Role-Based Access Control

Objective: Verify that each role can access only its permitted functions.

Test Steps:
1. Log in as administrator, inventory manager, purchasing manager, warehouse staff, and sales staff.
2. Attempt to access user management using each role.
3. Attempt product creation using different roles.
4. Request batch information as sales staff.
5. Attempt shipment receiving and purchase-order creation using unauthorized roles.
6. Check product information exposed to sales and warehouse staff.
7. Access inventory and purchasing reports using different roles.

Expected Results:
- User management is restricted to the administrator.
- Product creation is allowed for administrator and inventory manager accounts.
- Duplicate product creation is rejected with HTTP 409.
- Sales staff cannot access batches or restricted product details.
- Warehouse and sales responses do not expose unit cost.
- Purchase-order creation and shipment receiving enforce their configured permissions.
- Inventory and purchasing reports enforce role restrictions.

### TC-04: Role Permission Updates

Objective: Verify that administrator-managed role permissions take effect.

Test Steps:
1. Log in as administrator and inventory manager.
2. Confirm that the inventory manager cannot create purchase orders by default.
3. Grant the inventory role the `po.create` permission.
4. Attempt purchase-order creation with an empty request.
5. Restore the original permission list.
6. Attempt purchase-order creation again.
7. Attempt to remove protected administrator permissions.
8. Attempt to change the administrator's own role.

Expected Results:
- Purchase-order creation is initially forbidden.
- After permission is granted, the empty request reaches validation and returns HTTP 400.
- Restoring permissions returns access to the original restricted behavior.
- Required administrator permissions remain protected.
- The administrator cannot change their own role through the tested operation; the request returns HTTP 409.

### TC-05: Physical Count Discrepancy and Overselling Prevention

**Objective:** Verify that physical inventory counts limit availability and prevent overselling.

Test Steps:
1. Retrieve product availability as sales staff.
2. Check the test product with SKU `THM-2200`.
3. Attempt to order more units than the recorded available quantity.
4. Place an order within the available quantity.
5. Check the resulting availability.
6. Review the discrepancy alert as inventory staff.
7. Attempt to resolve the discrepancy without the required investigation or note.
8. Investigate and resolve the discrepancy using a stock adjustment.
9. Retrieve the product and alerts again.

Expected Results:
- The seeded test scenario reports 12 available units for `THM-2200`, despite a higher system quantity.
- An order exceeding available stock returns HTTP 409.
- The order error identifies insufficient stock.
- A valid order succeeds and reduces availability.
- The discrepancy is marked critical in the tested scenario.
- Resolution requires the prescribed investigation and note.
- After successful adjustment, the product's on-hand quantity matches the physical count and the discrepancy alert is cleared.

### TC-06: FEFO Picking and Shipment Workflow

**Objective:** Verify that picking follows expiry priority and that shipment actions respect workflow rules.

Test Steps:
1. Retrieve availability for product SKU `FLT-F023`.
2. Create a sales order for 40 units.
3. Retrieve the corresponding warehouse pick order.
4. Inspect the picking plan.
5. Attempt to complete picking before starting it.
6. Start picking and complete it.
7. Check the affected batches.
8. Ship the order.
9. Attempt to ship the same order again.
10. Attempt to cancel the order after the tested workflow has advanced.

Expected Results:
- The picking plan selects the nearest eligible expiry first.
- Expired batch `B-2105` is not selected.
- The tested plan picks 30 units from `B-2207` and 10 from `B-2311`.
- Completing before starting returns HTTP 409.
- Starting and completing picking succeeds.
- Shipment succeeds once; duplicate shipment returns HTTP 409.
- The tested cancellation attempt returns HTTP 409.
- Sales staff cannot perform the restricted warehouse picking action.

### TC-07: Shipment Receiving and Quantity Variance

Objective: Verify receiving validation, batch creation, and duplicate-receiving protection.

Test Steps:
1. Retrieve incoming shipment `SHP-0002` as warehouse staff.
2. Submit a receiving request with no items.
3. Submit a valid receiving request with a quantity of 90 for the tested item.
4. Attempt to receive the same shipment again.
5. Inspect the resulting batch and discrepancy alerts.

Expected Results:
- Receiving without items returns HTTP 400.
- Valid receiving succeeds and records a variance where expected.
- A batch is created with the received quantity and expiry information.
- Receiving the same shipment twice returns HTTP 409.
- Variance alerts are generated for review.

### TC-08: Purchasing and Supplier Validation

Objective: Verify purchase-order limits, purchase-order lifecycle, and supplier validation.

Test Steps:
1. Retrieve the reorder list and a supplier as purchasing staff.
2. Attempt to order 9,000 units of product `ACU-1000`.
3. Attempt to create a purchase order with no items.
4. Create and send a valid purchase order.
5. Attempt to send the same order again.
6. Cancel the purchase order.
7. Create a supplier with an invalid email.
8. Create a supplier with valid details.
9. Attempt to create a duplicate supplier.

Expected Results:
- An order above the configured maximum returns HTTP 409.
- A purchase order without items returns HTTP 400.
- A valid purchase order can be created and sent.
- Sending the same order again returns HTTP 409.
- The tested cancellation succeeds.
- Invalid supplier data returns HTTP 400.
- Valid supplier creation succeeds.
- Duplicate supplier creation returns HTTP 409.

### TC-09: Stock Adjustment Requests and Approval

**Objective:** Verify warehouse adjustment requests and inventory-manager approval.

Test Steps:
1. Identify product `ACC-REM`.
2. Submit a stock adjustment request as warehouse staff.
3. Attempt to approve the request as warehouse staff.
4. Record the product's on-hand quantity.
5. Approve the request as inventory staff.
6. Check the updated quantity.
7. Attempt to approve the same request again.
8. Submit an adjustment with an excessively large negative quantity.

Expected Results:
- The warehouse request is created with pending status.
- Warehouse staff cannot approve the request.
- Inventory staff can approve the request.
- The on-hand quantity decreases by the approved amount.
- Duplicate approval returns HTTP 409.
- The invalid adjustment returns HTTP 400.

### TC-10: Role-Specific Dashboards

bjective: Verify that each role receives the dashboard sections defined for it.

Test Steps:
1. Log in separately as administrator, inventory manager, purchasing manager, warehouse staff, and sales staff.
2. Request `/dashboard` for each role.
3. Check the response for the expected role-specific sections.

Expected Results:
- Each role receives HTTP 200 from the dashboard endpoint.
- The administrator dashboard includes KPIs, user activity, system status, and recent activity.
- The inventory dashboard includes KPIs, health, low stock, expiry, and discrepancies.
- The purchasing dashboard includes KPIs, reorder information, pending purchase orders, incoming shipments, and history.
- The warehouse dashboard includes KPIs, receiving, picking, shipping, inventory tasks, and alerts.
- The sales dashboard includes KPIs, availability, recent orders, status, and low-stock information.

### TC-11: Input Validation, API Hardening, Reports, and Logs

Objective: Verify invalid input handling and selected reporting and audit functions.

Test Steps:
1. Attempt to create a user with an invalid role.
2. Attempt to create a user with a short password.
3. Create a user with valid details.
4. Submit an invalid setting value.
5. Submit a valid setting value.
6. Send an unsupported content type to a protected endpoint.
7. Request an unknown endpoint.
8. Request the inventory expiry report in CSV format.
9. Retrieve administrator logs.
10. Register a new account and attempt to log in before approval.


Expected Results:
- Invalid user data returns HTTP 400.
- Valid user creation returns HTTP 201.
- Invalid settings return HTTP 400; valid settings return HTTP 200.
- Unsupported content types are rejected with an appropriate response, as asserted by the test.
- An unknown endpoint returns HTTP 404.
- The CSV report returns HTTP 200 and contains the expected batch heading.
- Administrator logs are returned.
- Public registration succeeds, but the newly registered account cannot immediately log in; the tested response is HTTP 403.

### TC-12: Reorder Point Calculation

Objective: Verify the reorder-point formula, including the seasonal multiplier.

Test Steps:
1. Retrieve the inventory product list.
2. Locate product SKU `ACU-1000`.
3. Calculate the expected reorder point using average daily usage, lead time, safety stock, and the seasonal rule.
4. Compare the calculated result with the product's reported reorder point.

**Expected Results:**
- The standard calculation uses:

  `Reorder Point = (Average Daily Usage × Lead Time) + Safety Stock`

- During the seasonal window defined in the test, the usage-and-lead-time component uses the seasonal multiplier.
- For the seeded test product, the expected value is calculated as either `3 × 14 + 12` outside the seasonal window or `3 × 14 × 4 + 12` inside the tested window.
- The returned reorder point matches the calculated expected value.

**Verification note:** Confirm the seasonal multiplier and expected values against the actual implementation before treating them as verified.

## 4. Test Result Recording

Record results only after executing the corresponding test.

| Test ID | Test Area | Result | Notes |
|---|---|---|---|
| TC-01 | Authentication | Not yet recorded | |
| TC-02 | Login lockout | Not yet recorded | |
| TC-03 | Role permissions | Not yet recorded | |
| TC-04 | Permission updates | Not yet recorded | |
| TC-05 | Physical count and overselling | Not yet recorded | |
| TC-06 | FEFO picking and shipment | Not yet recorded | |
| TC-07 | Receiving and variance | Not yet recorded | |
| TC-08 | Purchasing and suppliers | Not yet recorded | |
| TC-09 | Stock adjustments | Not yet recorded | |
| TC-10 | Dashboards | Not yet recorded | |
| TC-11 | Validation and reports | Not yet recorded | |
| TC-12 | Reorder calculation | Not yet recorded | |

### Result Definitions

- **Pass:** Actual result matches the expected result.
- **Fail:** Actual result differs from the expected result.
- **Blocked:** The test cannot be executed because a required service, account, database, or environment is unavailable.
- **Not yet recorded:** No execution result has been documented.

## 5. API Test Failure Documentation

When an automated API test fails, record the failure and investigate its cause before reporting it as a confirmed defect.

For each failure, document:

- Test case ID or automated test name
- API endpoint and HTTP method, when applicable
- Expected HTTP status code and response
- Actual HTTP status code and response
- Error message or sanitized test output
- Possible cause and investigation notes
- Related bug ID in `bug-reports.md`, if a defect is confirmed
- Retest result after a fix is provided

A failed assertion may be caused by an application defect, incorrect test data, missing permissions, database configuration, or an unavailable service. Confirm the cause before assigning a final bug status.

## 6. Test Execution Notes

- Execute tests only in an appropriate development or test environment.
- Verify that the API server, database, dependencies, and required test accounts are available.
- Record actual results instead of assuming that documented expected results have passed.
- Update the test result table after execution.
- Link confirmed defects to their corresponding test cases.
- Keep the QA summary consistent with the recorded results.

## 7. Source Reference

These test cases are derived from the automated test source `tests/api.test.mjs`. The test file should remain the primary reference for the automated API assertions. This document summarizes those assertions for QA reporting and documentation purposes.