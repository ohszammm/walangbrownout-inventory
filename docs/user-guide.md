# User Guide
## WalangBrownout Inventory Management System

## 1. Introduction

The WalangBrownout Inventory Management System is designed to manage inventory records, monitor stock availability, handle purchasing and receiving activities, and support warehouse and sales operations.

This guide explains the system's intended workflows, user roles, and common troubleshooting procedures.

## 2. User Roles

The system includes the following roles:

| Role | Main Responsibilities |
|---|---|
| Administrator | Manage users, system settings, and role permissions |
| Inventory Manager | Monitor inventory, manage products, investigate stock discrepancies, and approve stock adjustments |
| Purchasing Manager | Manage suppliers, review reorder information, and manage purchase orders |
| Warehouse Staff | Receive incoming shipments, handle picking and shipping workflows, and submit stock adjustment requests |
| Sales Staff | Check product availability and manage permitted sales-order activities |

Available actions depend on the account's assigned permissions. Some actions may be restricted even when a user can access the corresponding module.

Important: Do not use another person's account or attempt to bypass role restrictions.

## 3. Logging In

1. Open the system in your browser.
2. Enter your account credentials.
3. Select the login option.
4. After successful authentication, access the dashboard available to your role.

### Account Access Notes

- Use an active account with valid credentials.
- Disabled accounts cannot log in.
- Newly registered accounts may require administrator approval.
- Repeated failed login attempts may trigger a temporary lockout.
- Contact the administrator if you cannot access your account.

Tip: Check your username, password, and account status before attempting another login. Repeated incorrect attempts may cause additional restrictions.

## 4. Dashboard

After logging in, the system displays a role-specific dashboard.

Depending on the assigned role and permissions, the dashboard may provide:

- Key performance indicators
- Low-stock information
- Inventory expiry information
- Stock discrepancy alerts
- Pending purchase orders
- Incoming shipment information
- Picking and shipping tasks
- Recent sales orders
- User activity and system status

### Dashboard Best Practices

1. Review the information relevant to your role.
2. Check alerts that require immediate attention.
3. Review low-stock and expiry information before making inventory decisions.
4. Open the relevant module to investigate an alert.
5. Confirm important changes in the appropriate records.

**Tip:** Dashboard figures provide a quick overview. Review the corresponding records before making decisions based on the displayed totals.

## 5. Inventory Management

Inventory staff can manage product information and monitor stock conditions according to their permissions.

### 5.1 General Inventory Workflow

1. Open the inventory or product section.
2. Review the available product records.
3. Search for the product that needs attention.
4. Review its stock availability and related alerts.
5. Update product information only when authorized.
6. Investigate discrepancies between recorded quantities and physical counts.

Important reminders:

- Verify the product identifier before editing a record.
- Confirm the quantity and product details before saving changes.
- Investigate discrepancies instead of immediately changing the recorded quantity.
- Do not expose restricted product, batch, or cost information to unauthorized users.

### 5.2 Low Stock and Reorder Information

The system uses reorder-point calculations to help identify products that may need replenishment.

The general formula is:

`Reorder Point = (Average Daily Usage × Lead Time) + Safety Stock`

A seasonal multiplier may also apply during the configured seasonal window.

Review reorder information before initiating replenishment activities.

Tip: A low-stock alert indicates that replenishment may be needed; it does not automatically mean a purchase order has already been created.

## 6. Warehouse Operations

Warehouse staff handle receiving, picking, and shipping workflows.

### 6.1 Receiving Incoming Shipments

1. Open the incoming shipments section.
2. Select the shipment to receive.
3. Review the shipment details.
4. Verify the products and expected quantities.
5. Enter the received quantities as required by the system.
6. Submit the receiving request.
7. Review any quantity variance or discrepancy alerts.
8. Confirm the resulting shipment status.

Received stock may create inventory batches containing quantity and expiry information.

Important reminders:

- Count the physical items before submitting the receiving request.
- Record actual received quantities accurately.
- Report missing, damaged, or excess items according to the applicable procedure.
- Do not receive the same shipment twice.
- Review the shipment status before resubmitting a request.

### 6.2 FEFO Picking

FEFO means First Expired, First Out. Eligible stock with the nearest expiry date should be selected first.

1. Open the assigned picking order.
2. Review the picking plan.
3. Check the eligible inventory batches.
4. Start the picking workflow.
5. Pick the specified quantities according to the plan.
6. Complete the picking workflow when the required steps are finished.

important reminders:

- Do not select expired stock.
- Follow the system-generated picking plan.
- Check the batch identifier and expiry date before picking.
- Do not substitute another batch without authorization.
- Follow the system's validation messages if an action is attempted out of sequence.

### 6.3 Shipping Orders

1. Open the relevant order or warehouse workflow.
2. Confirm that the required picking steps are complete.
3. Review the order details and current status.
4. Verify that the order is ready for shipment.
5. Submit the shipping action when permitted.
6. Confirm the resulting status.

The system may prevent repeated or invalid workflow actions, such as shipping the same order twice.

Tip: Confirm that picking is complete before shipping. If the status does not change as expected, review the order before attempting the action again.

## 7. Purchasing and Suppliers

Purchasing staff manage supplier information and purchase orders.

### 7.1 Supplier Management

1. Open the supplier section.
2. Review existing supplier records.
3. Enter the required supplier details when creating a record.
4. Verify the supplier's contact information and other required fields.
5. Submit the record.
6. Confirm that the supplier was saved successfully.

Invalid supplier information and duplicate supplier records may be rejected by the system.

Tip: Check the supplier's details before submitting. If validation fails, correct the information rather than repeatedly submitting the same record.

### 7.2 Purchase Orders

1. Review the reorder list and available supplier information.
2. Select the products that require replenishment.
3. Enter the requested quantities.
4. Verify that the quantities comply with the system's limits.
5. Create the purchase order.
6. Review its items, supplier, quantities, and status.
7. Send or cancel the purchase order when the current status permits the action.
8. Confirm the resulting status.

Purchase orders must contain valid items. The system may reject orders that exceed configured limits or attempt an invalid status transition.

Important reminders:

- Check product quantities before creating an order.
- Verify the supplier before sending the purchase order.
- Review the current status before sending or cancelling.
- Avoid duplicate submissions.
- Follow the purchasing workflow if an order is rejected.

## 8. Stock Adjustment Requests

Stock adjustments are used to correct inventory quantities after a discrepancy has been investigated.

### General Workflow

1. Identify the product requiring an adjustment.
2. Compare the recorded quantity with the physical count.
3. Investigate the cause of the discrepancy.
4. Document the reason and supporting information.
5. Submit a stock adjustment request if authorized.
6. Have an inventory manager review the request.
7. Approve or reject the request according to the applicable permissions and workflow.
8. Confirm the resulting inventory quantity.

Warehouse staff may submit adjustment requests, while inventory staff handle approval, depending on the configured permissions.

Important reminders:

- Never adjust stock solely to remove an alert without investigating the cause.
- Use accurate physical counts and supporting information.
- Do not approve your own request unless the system's authorized workflow explicitly permits it.
- Verify the final quantity after an adjustment is approved.
- Report unusually large or unexplained differences.

## 9. Sales and Stock Availability

Sales staff can review available products and perform permitted sales-order activities.

1. Open the sales or product availability section.
2. Search for the required product.
3. Review the available quantity.
4. Enter the requested order details.
5. Verify that the requested quantity is available.
6. Submit the order if permitted.
7. Review the resulting order status.

The system checks available stock to help prevent overselling. An order may be rejected when the requested quantity exceeds available stock.

Access to batch details, costs, and other restricted information depends on the user's permissions.

Important reminders:

- Check availability immediately before submitting an order.
- Do not assume that stock displayed earlier is still available.
- Do not create repeated orders when a submission appears delayed.
- Review the order status before trying again.
- Contact the appropriate inventory staff if the requested quantity is unavailable.

## 10. Reports and Activity Logs

Depending on assigned permissions, users may access inventory reports, expiry information, and other operational reports. Administrators may also review activity logs.

### Using Reports

1. Open the report available to your role.
2. Select the required filters, if available.
3. Review the displayed information.
4. Export the report when an export option is available.
5. Check the report contents before using them for operational decisions.

### Reviewing Activity Logs

Authorized administrators may use activity logs to investigate system actions and support troubleshooting.

When reporting an issue, provide the relevant time, module, action performed, and error message. Avoid including passwords or other sensitive credentials.

Tip: Confirm the report's date range and filters before interpreting its results.

## 11. Error Messages and Troubleshooting

| Situation | Recommended Action |
|---|---|
| Login fails | Check the credentials and account status |
| Account is pending or disabled | Contact the administrator |
| Login lockout occurs | Wait according to the applicable policy or contact the administrator |
| Access is forbidden | Confirm that the account has the required permission |
| Requested stock is unavailable | Review available quantities before retrying |
| Purchase order is rejected | Check item details, quantities, supplier information, and order status |
| Shipment has already been received | Review its current status before taking further action |
| Stock adjustment is rejected | Review the request, quantity, permissions, and approval status |
| Validation error appears | Check the required fields and supplied values |
| Duplicate record is rejected | Search for an existing record before creating another |
| An action is rejected because of workflow status | Review the current status and complete the required preceding steps |
| Unexpected server error occurs | Record the action and error message, then report it to the project team |

### Reporting a Problem

When reporting a problem, include:

- The module or feature involved
- The action performed before the error
- The expected result
- The actual result and error message
- The date and time of occurrence
- A screenshot or other evidence, if available and safe to share

Do not include passwords, authentication tokens, or unnecessary personal information in screenshots or reports.

## 12. Security and Good Practices

- Keep account credentials private.
- Use only the functions permitted for your role.
- Verify quantities before receiving, picking, shipping, or adjusting stock.
- Review expiry dates when handling inventory batches.
- Investigate inventory discrepancies before requesting corrections.
- Avoid repeating an action after a successful submission.
- Verify record status after important operations.
- Do not share restricted inventory, batch, or cost information.
- Report unexpected behavior to the administrator or development team.
- Follow the organization's procedures for handling inventory records and operational data.

## 13. Documentation Note

This guide describes the system's intended workflows based on the documented roles and functionality. Exact screen names, buttons, permissions, validation messages, and procedures should be confirmed against the running application before this guide is treated as a fully verified end-user manual.

The guide should be updated whenever the application workflow, user permissions, or system behavior changes.