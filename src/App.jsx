import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import RequireAuth, { RequirePerm } from './auth/RequireAuth';
import Dashboard from './pages/Dashboard';
import { InventoryPage, StockLevelsPage, ProductDetail } from './pages/Inventory';
import { BatchesPage, BatchDetail } from './pages/Batches';
import { StockCountPage, DiscrepanciesPage, AdjustmentsPage } from './pages/Counts';
import { ShipmentsPage } from './pages/Shipments';
import MovementsPage from './pages/Movements';
import AlertsPage from './pages/Alerts';
import { ReorderPage, PurchaseOrdersPage, PODetail, SuppliersPage, PurchaseHistoryPage } from './pages/Purchasing';
import PickOrdersPage from './pages/PickOrders';
import { NewOrderPage, SalesOrdersPage, SalesOrderDetail, AvailabilityPage, SearchProductsPage } from './pages/Sales';
import { UsersPage, RolesPage, LogsPage, SettingsPage } from './pages/Admin';
import ReportsPage from './pages/Reports';
import AccountPage from './pages/Account';

const P = ({ perm, children }) => <RequirePerm perm={perm}>{children}</RequirePerm>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<P perm="inventory.view"><InventoryPage /></P>} />
        <Route path="stock-levels" element={<P perm="inventory.view"><StockLevelsPage /></P>} />
        <Route path="inventory/:sku" element={<P perm="inventory.view"><ProductDetail /></P>} />
        <Route path="batches" element={<P perm="batches.view"><BatchesPage /></P>} />
        <Route path="batches/:id" element={<P perm="batches.view"><BatchDetail /></P>} />
        <Route path="stock-count" element={<P perm="count.view"><StockCountPage /></P>} />
        <Route path="discrepancies" element={<P perm="count.view"><DiscrepanciesPage /></P>} />
        <Route path="adjustments" element={<P perm={['adjust.approve', 'adjust.request']}><AdjustmentsPage /></P>} />
        <Route path="shipments" element={<Navigate to="/shipments/incoming" replace />} />
        <Route path="shipments/:dir" element={<P perm="shipments.view"><ShipmentsPage /></P>} />
        <Route path="movements" element={<P perm="movements.view"><MovementsPage /></P>} />
        <Route path="alerts" element={<P perm="alerts.view"><AlertsPage /></P>} />
        <Route path="alerts/:group" element={<P perm="alerts.view"><AlertsPage /></P>} />
        <Route path="reorder" element={<P perm="reorder.view"><ReorderPage /></P>} />
        <Route path="purchase-orders" element={<P perm="po.view"><PurchaseOrdersPage /></P>} />
        <Route path="purchase-orders/:id" element={<P perm="po.view"><PODetail /></P>} />
        <Route path="suppliers" element={<P perm="suppliers.view"><SuppliersPage /></P>} />
        <Route path="purchase-history" element={<P perm="po.view"><PurchaseHistoryPage /></P>} />
        <Route path="pick-orders" element={<P perm="shipments.process"><PickOrdersPage /></P>} />
        <Route path="sales/new" element={<P perm="sales.create"><NewOrderPage /></P>} />
        <Route path="sales/orders" element={<P perm="sales.view"><SalesOrdersPage /></P>} />
        <Route path="sales/history" element={<P perm="sales.view"><SalesOrdersPage history /></P>} />
        <Route path="sales/orders/:id" element={<P perm="sales.view"><SalesOrderDetail /></P>} />
        <Route path="availability" element={<P perm="inventory.view"><AvailabilityPage /></P>} />
        <Route path="search" element={<P perm="inventory.view"><SearchProductsPage /></P>} />
        <Route path="users" element={<P perm="users.manage"><UsersPage /></P>} />
        <Route path="roles" element={<P perm="roles.manage"><RolesPage /></P>} />
        <Route path="logs" element={<P perm="logs.view"><LogsPage /></P>} />
        <Route path="settings" element={<P perm="settings.manage"><SettingsPage /></P>} />
        <Route path="reports/abc" element={<P perm="reports.inventory"><ReportsPage key="abc" abc /></P>} />
        <Route path="reports/:group" element={<P perm={['reports.inventory', 'reports.purchasing']}><ReportsPage /></P>} />
        <Route path="account" element={<AccountPage />} />
        <Route path="*" element={<div className="card" style={{ padding: 40, textAlign: 'center' }}><h2>Page not found</h2></div>} />
      </Route>
    </Routes>
  );
}
