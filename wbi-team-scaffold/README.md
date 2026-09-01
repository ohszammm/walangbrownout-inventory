# WalangBrownout Inventory (Frontend)

React + React Router prototype for the WalangBrownout Appliances inventory
system. Sidebar navigation with dedicated Overview / Inventory / Batches /
Alerts / Receiving pages, a shared in-memory data layer so actions actually
change what you see, live-computed reorder points and alerts, and the
project's Inter / IBM Plex Mono type system with the accent/critical/
warning/success/info color palette.

## Run it

npm install
npm run dev

Then open the printed local URL (typically http://localhost:5173).
Sign in with admin@walangbrownout.test / password.

## Structure

- src/pages/            Overview, Inventory, Batches, Alerts, ItemDetail, Receiving, Login
- src/components/        Layout (responsive sidebar shell), LiveClock, UI.jsx (Pill, KpiTile, Card, PageHeader, StockBar)
- src/auth/              Frontend-only mock login (AuthContext, RequireAuth) - no real backend yet
- src/state/ItemsContext.jsx   Shared item state for the whole app - pickBatch, resolveVariance, receiveBatch all live here
- src/data/items.js      Seed data only. ItemsContext clones this once on load; nothing else imports it directly
- src/utils/reorder.js   Reorder point formula (avg daily usage x lead time + safety stock, with seasonal multiplier), uses the real live clock
- src/utils/deriveAlerts.js   Computes low-stock, overstock, expiring, and variance alerts from whatever items array is passed in
- src/styles/global.css        Design tokens, sidebar/nav, tables, pills, forms - single shared stylesheet

## Routes

- /              Overview (KPIs, top alerts, seasonal items, recent activity)
- /inventory     All items, Class A/B/C + FEFO-critical + Seasonal filter tabs, Available column, stock bars, status pills
- /batches       Every batch across all items, FEFO pick order, explicit Pick action
- /alerts        Full alert list with severity tiers, Resolve (variance) and Acknowledge (everything else)
- /items/:sku    Item detail - batches, reorder policy, transaction log, working Pick action
- /receive       Receive new shipment (item picked from a dropdown of real items, not free text)
- /login         Sign in (demo credentials shown on screen)

## What's genuinely dynamic here

Every reorder point, stock status pill, and alert is computed live from
src/state/ItemsContext.jsx on every render - nothing is a hardcoded
string. Three actions actually mutate that shared state, not just the UI:

- Picking a batch (Item Detail or Batches) decrements on-hand and logs a
  transaction.
- Resolving a count variance (Alerts) writes the corrected quantity as
  the new on-hand figure and clears the flag - the system never
  auto-corrects a discrepancy, a person has to.
- Receiving a shipment creates a real batch and updates on-hand.

Because all three write to the same shared state, doing any of them
updates the KPI counts, alert list, and stock table everywhere else in
the app immediately, without a page reload.

The reorder point calculator and every expiry countdown use the real
current date/time (`new Date()`), not a fixed simulated date - see the
live clock in the top-right corner of every page.

## What still needs the backend

This is frontend-only: state lives in your browser tab and resets on a
full page reload. Login is a client-side mock (see
src/auth/AuthContext.jsx). The Laravel backend built earlier implements
the same formulas and alert logic server-side, against a real database
with real sessions, for when you're ready to connect them.
