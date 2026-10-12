// Sidebar structure per role, taken from the CCS112 Front-End Guide.
const D = { to: '/', label: 'Dashboard', end: true, icon: 'dashboard' };
const INV = { to: '/inventory', label: 'Inventory', icon: 'boxes' };
const BAT = { to: '/batches', label: 'Batches', icon: 'layers' };
const IN = (label = 'Incoming Shipments') => ({ to: '/shipments/incoming', label, badge: 'incoming', icon: 'truck' });
const OUT = (label = 'Outgoing Shipments') => ({ to: '/shipments/outgoing', label, icon: 'send' });

export const NAV = {
  admin: [
    { items: [D] },
    { title: 'Inventory', items: [INV, BAT] },
    { title: 'Shipments', items: [IN(), OUT()] },
    { title: 'User Management', items: [{ to: '/users', label: 'Users', icon: 'users', badge: 'pending_users' }, { to: '/roles', label: 'Roles & Permissions', icon: 'shield' }] },
    { title: 'Reports', items: [{ to: '/reports/inventory', label: 'Inventory Reports', icon: 'report' }, { to: '/reports/abc', label: 'ABC Analysis', icon: 'pie' }] },
    { title: 'System', items: [{ to: '/logs', label: 'Activity Logs', icon: 'scroll' }, { to: '/settings', label: 'System Settings', icon: 'settings' }] },
  ],
  inventory: [
    { items: [D] },
    { title: 'Inventory', items: [INV, BAT, { to: '/stock-count', label: 'Stock Count', icon: 'count' }, { to: '/adjustments', label: 'Stock Adjustments', icon: 'sliders', badge: 'adjustments' }, { to: '/discrepancies', label: 'Stock Discrepancies', icon: 'alert', badge: 'discrepancies' }] },
    { title: 'Shipments', items: [IN(), OUT(), { to: '/movements', label: 'Stock Movements', icon: 'moves' }] },
    { title: 'Alerts', items: [{ to: '/alerts/low-stock', label: 'Low Stock Alerts', icon: 'lowstock', badge: 'low_stock' }, { to: '/alerts/expiry', label: 'Expiry Alerts', icon: 'expiry', badge: 'expiry' }] },
    { title: 'Purchasing', items: [{ to: '/purchase-orders', label: 'Purchase Orders', icon: 'po' }, { to: '/suppliers', label: 'Suppliers', icon: 'supplier' }] },
    { title: 'Reports', items: [{ to: '/reports/inventory', label: 'Inventory Reports', icon: 'report' }, { to: '/reports/abc', label: 'ABC Analysis', icon: 'pie' }] },
  ],
  purchasing: [
    { items: [D] },
    { title: 'Inventory', items: [INV, { to: '/stock-levels', label: 'Stock Levels', icon: 'levels' }, BAT] },
    { title: 'Purchasing', items: [{ to: '/reorder', label: 'Reorder Alerts', icon: 'reorder', badge: 'reorder' }, { to: '/purchase-orders', label: 'Purchase Orders', icon: 'po' }, { to: '/suppliers', label: 'Suppliers', icon: 'supplier' }, { to: '/purchase-history', label: 'Purchase History', icon: 'history' }] },
    { title: 'Shipments', items: [IN('Incoming Shipments')] },
    { title: 'Reports', items: [{ to: '/reports/purchasing', label: 'Purchasing Reports', icon: 'report' }] },
  ],
  warehouse: [
    { items: [D] },
    { title: 'Inventory', items: [INV, BAT, { to: '/stock-count', label: 'Stock Count', icon: 'count' }] },
    { title: 'Warehouse', items: [IN(), { to: '/pick-orders', label: 'Pick Orders', icon: 'pick', badge: 'pick' }, { ...OUT(), badge: 'ship' }, { to: '/movements', label: 'Stock Movements', icon: 'moves' }] },
    { title: 'Alerts', items: [{ to: '/alerts/low-stock', label: 'Low Stock Alerts', icon: 'lowstock', badge: 'low_stock' }, { to: '/alerts/expiry', label: 'Expiry Alerts', icon: 'expiry', badge: 'expiry' }] },
  ],
  sales: [
    { items: [D] },
    { title: 'Sales', items: [{ to: '/sales/new', label: 'New Order', icon: 'neworder' }, { to: '/sales/orders', label: 'Sales Orders', icon: 'orders' }, { to: '/sales/history', label: 'Order History', icon: 'history' }] },
    { title: 'Inventory', items: [{ to: '/availability', label: 'Product Availability', icon: 'availability' }, { to: '/search', label: 'Search Products', icon: 'search' }] },
    { title: 'Shipments', items: [OUT('Outgoing Shipment Status')] },
  ],
};
export const ROLE_LABEL = { admin: 'System Administrator', inventory: 'Inventory Manager', purchasing: 'Purchasing Manager', warehouse: 'Warehouse Staff', sales: 'Sales Staff' };
export const ROLE_MOTTO = { admin: 'Manages user accounts, roles, permissions and system settings.', inventory: 'Oversees stock accuracy, counts, adjustments and reorder planning.', purchasing: 'Manages suppliers, purchase orders and stock replenishment.', warehouse: 'Receives shipments, moves stock between bins and picks orders.', sales: 'Checks product availability and creates and tracks customer orders.' };
