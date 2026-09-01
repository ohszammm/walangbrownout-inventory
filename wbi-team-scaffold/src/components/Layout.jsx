import { Outlet } from "react-router-dom";

// TODO (Jan Cedric): Build the real responsive sidebar shell here - nav
// links (Overview / Inventory / Batches / Alerts / Receive shipment),
// active-link highlighting, mobile hamburger toggle, sign-out button, user
// chip. Must keep rendering <Outlet /> so nested page routes still render.
export default function Layout() {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <p>TODO: sidebar navigation shell goes here (Jan Cedric)</p>
      <hr />
      <Outlet />
    </div>
  );
}
