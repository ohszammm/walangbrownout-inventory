# User Guide
## WalangBrownout Inventory Management System

## 1. Introduction

The WalangBrownout Inventory Management System is designed to help manage inventory records, monitor stock availability, handle purchasing and receiving activities, and support warehouse and sales operations.

This guide explains the main workflows and role-specific functions covered by the system.

## 2. User Roles

The system includes the following roles:

| Role | Main Responsibilities |
|---|---|
| Administrator | Manage users, system settings, and role permissions |
| Inventory Manager | Monitor inventory, manage products, review stock discrepancies, and approve stock adjustments |
| Purchasing Manager | Manage suppliers, review reorder information, and create and manage purchase orders |
| Warehouse Staff | Receive incoming shipments, handle picking and shipping workflows, and submit stock adjustment requests |
| Sales Staff | Check product availability and manage permitted sales-order activities |

Available actions depend on the account's assigned permissions.

## 3. Logging In

1. Open the system in your browser.
2. Enter your account credentials.
3. Select the login option.
4. After successful authentication, access the dashboard available to your role.

### Account Access Notes

- Use an active account with valid credentials.
- Disabled accounts cannot log in.
- Newly registered accounts may require administrator approval.
- If repeated failed login attempts trigger a lockout, contact the administrator for assistance.

## 4. Dashboard

After logging in, the system displays a role-specific dashboard.

Depending on the assigned role, the dashboard may provide:

- Key performance indicators
- Low-stock information
- Inventory expiry information
- Stock discrepancy alerts
- Pending purchase orders
- Incoming shipment information
- Picking and shipping tasks
- Recent sales orders
- User activity and system status

The available dashboard sections depend on the user's role and permissions.

## 5. Inventory Management

Inventory staff can manage product information and monitor stock conditions.

### General Workflow

1. Open the inventory or product section.
2. Review the available product records.
3. Search for the product that needs attention.
4. Review its stock availability and related alerts.
5. Update product information only when authorized.
6. Investigate discrepancies between recorded quantities and physical counts.

### Low Stock and Reorder Information

The system uses reorder-point calculations to help identify products that may need replenishment.

The general formula is:

`Reorder Point = (Average Daily Usage × Lead Time) + Safety Stock`

A seasonal multiplier may also apply during the configured seasonal window.

Review the reorder information before initiating replenishment activities.

## 6. Warehouse Operations

Warehouse staff handle receiving, picking, and shipping workflows.

### 6.1 Receiving Incoming Shipments

1. Open the incoming shipments section.
2. Select the shipment to receive.
3. Review the shipment details.
4. Enter the received quantities as required by the system.
5. Submit the receiving request.
6. Review any quantity variance or discrepancy alerts.

Received stock may create inventory batches containing quantity and expiry information.

Do not receive the same shipment twice. Review the shipment status before submitting a receiving request.

### 6.2 FEFO Picking

FEFO means **First Expired, First Out**. Eligible stock with the nearest expiry date should be selected first.

1. Open the assigned picking order.
2. Review the picking plan.
3. Start the picking workflow.
4. Pick the specified quantities according to the plan.
5. Complete the picking workflow when the required steps are finished.

Expired stock must not be selected for picking. Follow the system's validation messages if an action is attempted out of sequence.

### 6.3 Shipping Orders

1. Open the relevant order or warehouse workflow.
2. Confirm that the required picking steps are complete.
3. Review the order status.
4. Submit the shipping action when permitted.
5. Confirm the resulting status.

The system prevents certain repeated or invalid workflow actions, such as shipping the same order twice.

## 7. Purchasing and Suppliers

Purchasing staff manage supplier information and purchase orders.

### 7.1 Supplier Management

1. Open the supplier section.
2. Review existing supplier records.
3. Enter the required supplier details when creating a record.
4. Check that the supplied information is valid.
5. Submit the record.

Invalid supplier information and duplicate supplier records may be rejected by the system.

### 7.2 Purchase Orders

1. Review the reorder list and available supplier information.
2. Select the products that require replenishment.
3. Enter the requested quantities.
4. Check that the quantities comply with the system's limits.
5. Create the purchase order.
6. Review its details and status.
7. Send or cancel the purchase order when the current status permits the action.

Purchase orders must contain valid items. The system may reject orders that exceed configured limits or attempt an invalid status transition.

## 8. Stock Adjustment Requests

Stock adjustments are used to correct inventory quantities when a discrepancy has been investigated.

### General Workflow

1. Identify the product requiring an adjustment.
2. Review the recorded quantity and physical count.
3. Investigate the cause of the discrepancy.
4. Submit a stock adjustment request if authorized.
5. Have an inventory manager review the request.
6. Approve or reject the request according to the applicable permissions and workflow.
7. Confirm the resulting inventory quantity.

Warehouse staff may submit adjustment requests, while inventory staff handle approval. Only submit an adjustment when the supporting information is accurate.

## 9. Sales and Stock Availability

Sales staff can review available products and perform permitted sales-order activities.

1. Open the sales or product availability section.
2. Search for the required product.
3. Review the available quantity.
4. Enter the requested order details.
5. Submit the order if the requested quantity is available.
6. Review the order status.

The system checks available stock to help prevent overselling. An order may be rejected when the requested quantity exceeds available stock.

Access to batch details, costs, and other restricted information depends on the user's permissions.

## 10. Reports and Activity Logs

Depending on assigned permissions, users may access inventory reports, expiry information, and other operational reports.

Administrators may also review activity logs.

When using reports:

1. Open the report available to your role.
2. Review the displayed information.
3. Export the report when an export option is available.
4. Check the report contents before using them for operational decisions.

## 11. Error Messages and Troubleshooting

| Situation | Recommended Action |
|---|---|
| Login fails | Check the credentials and account status |
| Account is pending or disabled | Contact the administrator |
| Access is forbidden | Confirm that the account has the required permission |
| Requested stock is unavailable | Review available quantities before retrying |
| Purchase order is rejected | Check the item details, quantities, and order status |
| Shipment has already been received | Review its current status before taking further action |
| Stock adjustment is rejected | Review the request, quantity, permissions, and approval status |
| Validation error appears | Check the required fields and supplied values |
| Unexpected server error occurs | Record the action and error message, then report it to the project team |

## 12. Security and Good Practices

- Keep account credentials private.
- Use only the functions permitted for your role.
- Verify quantities before receiving, picking, shipping, or adjusting stock.
- Review expiry dates when handling batches.
- Investigate inventory discrepancies before requesting corrections.
- Avoid repeating an action after a successful submission.
- Report unexpected behavior to the administrator or development team.

## 13. Documentation Note

This guide describes the system's intended workflows based on the documented roles and functionality. Exact screen names, buttons, and procedures should be confirmed against the running application before this guide is treated as a fully verified end-user manual.
