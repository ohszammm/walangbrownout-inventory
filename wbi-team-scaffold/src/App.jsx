import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Overview from "./pages/Overview";
import Inventory from "./pages/Inventory";
import Batches from "./pages/Batches";
import Alerts from "./pages/Alerts";
import ItemDetail from "./pages/ItemDetail";
import Receiving from "./pages/Receiving";
import Login from "./pages/Login";
import RequireAuth from "./auth/RequireAuth";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="batches" element={<Batches />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="items/:sku" element={<ItemDetail />} />
        <Route path="receive" element={<Receiving />} />
      </Route>
    </Routes>
  );
}
