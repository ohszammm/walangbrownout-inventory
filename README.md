# WalangBrownout Inventory Management System

An inventory management system for **WalangBrownout Appliances**, a regional distributor of portable air conditioners, air purifiers, replacement filters and smart thermostats. It replaces the company's weekly, manually updated spreadsheet with real-time, batch-level stock tracking, expiry-aware picking, and reorder alerts.

Built for **CCS112 – Application Development and Emerging Technologies**, College of Computing Studies, University of Cabuyao (3CS-B), as the working implementation of our *Analysis and Architecture Blueprint*.

> Laravel API (`/api/*`) + React single-page app, in one repository. SQLite by default, MySQL optional.

---

## The Problem We Solve

Sales grew 35% in two years, yet profit fell because of warehouse costs and write-offs. Every issue traces back to one weekly spreadsheet:

| Problem | Cause | How the system fixes it |
|---|---|---|
| **Summer Crunch**: AC units sell out each June, then a triple order in August overfills the warehouse | No seasonal forecasting or order limits | Seasonal reorder point (raised one lead time *before* the season) and a hard **maximum stock** limit on purchase orders |
| **Mystery Shrinkage**: spreadsheet says 45 thermostats, the shelf has 12 | Weekly manual updates instead of real-time tracking | Live **on-hand / reserved / available** figures, a full movement log, and **discrepancy alerts** on physical counts |
| **Expiry Trap**: ₱15,000 of air purifier filters expire at the back of the shelf | Staff pick by shelf position, not expiry date | **Batch-level expiry tracking** with **FEFO** picking (First-Expiry-First-Out) and expiry alerts |

---

## Key Features

- **Real-time stock figures**: on-hand, reserved and available are computed live from batches and orders, never stored as a stale number.
- **Batch tracking**: every shipment becomes its own batch with supplier, received date, expiry date and bin location.
- **Oversell protection**: sales orders can only reserve what is *available*.
- **FEFO / FIFO picking**: nearest expiry first for perishable stock, oldest-received first otherwise. Expired batches are never picked.
- **Reorder logic**: reorder point = average daily usage × lead time + safety stock, with a seasonal multiplier for AC units. Safety stock = *z* × standard deviation of daily demand × √lead time, calculated from picking history.
- **Alerts**: low stock, overstock, expired / expiring batches (default 60-day window), count discrepancies, receiving variances, delayed shipments.
- **Physical counts and adjustments**: a count that differs from the system raises a discrepancy instead of silently overwriting stock. Adjustments need approval.
- **ABC analysis**: products ranked by yearly usage value, with a recommended class and review cycle.
- **Role-based access**: five roles with configurable permissions, an activity log, and system settings.
- **Reports**: inventory summary, ABC analysis, expiry, movement and purchasing reports.
- **Light and dark mode**, profile photos, and a simple interface for warehouse staff.

### Who uses what

| Role | Main workspace |
|---|---|
| System Administrator | Users, roles and permissions, activity logs, system settings |
| Inventory Manager | Inventory, batches, counts, adjustment approvals, alerts, ABC report |
| Purchasing Manager | Reorder suggestions, suppliers, purchase orders, incoming shipments |
| Warehouse Staff / Picker | Receiving, pick orders, outgoing shipments, physical counts |
| Sales Staff | Product availability, sales orders |

---

## Tech Stack

- **Backend:** Laravel 12 (PHP 8.2+), REST JSON API under `/api`
- **Frontend:** React 19, React Router 7, Vite, plain CSS (Inter and Plus Jakarta Sans fonts)
- **Database:** SQLite by default (zero setup), MySQL optional
- **Auth:** cookie-based login sessions (token stored hashed in the database), with role permissions enforced per route
- **Testing:** 12 end-to-end API tests (`node --test`)
- **Tooling:** Composer, npm, oxlint, Git and GitHub

> Frontend and backend live in the **same repo**: Laravel serves the API and the built React app, so there is no separate frontend project or CORS setup.

---

## Getting Started

**Requirements:** PHP 8.2+ (with `pdo_sqlite` or `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `ctype`, `tokenizer`, `xml`), Composer 2, Node 20.19+ (or 22+). In XAMPP, enable `extension=pdo_sqlite` or `extension=pdo_mysql` in `php.ini`.

```bash
# 1. Clone the repo
git clone <repo-url>
cd wbi

# 2. Install dependencies
composer install
npm install

# 3. Create the env file and app key
cp .env.example .env            # Windows: copy .env.example .env
php artisan key:generate

# 4. Create the database and load the demo data
#    (if database/database.sqlite is missing, create an empty file there first)
php artisan migrate:fresh --seed

# 5. Build the React app and start the server
npm run build
php artisan serve               # open http://localhost:8000
```

**Front-end development:** keep `php artisan serve` running and, in a second terminal, run `npm run dev`, then open http://localhost:5173 (it proxies `/api` to Laravel and hot-reloads).

**Using MySQL instead:** create a database, edit the `DB_*` lines in `.env` (see `.env.example`), then re-run `php artisan migrate:fresh --seed`.

### Demo accounts

All demo accounts use the password `password`.

| Email | Role | Demo user |
|---|---|---|
| `admin@walangbrownout.test` | System Administrator | Samuel Moro |
| `inventory@walangbrownout.test` | Inventory Manager | Cornelio Maño |
| `purchasing@walangbrownout.test` | Purchasing Manager | Desiree Morasa |
| `warehouse@walangbrownout.test` | Warehouse Staff / Picker | Jan Cedric Nuqui |
| `sales@walangbrownout.test` | Sales Staff | Cholo Ordonia |

`intern@walangbrownout.test` is a disabled account and `paolo@example.com` is pending approval. They exist to demonstrate account states. **Change or remove these accounts before any real use.**

### Resetting and testing

```bash
php artisan migrate:fresh --seed     # wipe and reload the demo data
npm run test:api                     # 12 API tests (needs a freshly seeded DB and php artisan serve running)
npm run lint                         # oxlint
```

---

## Project Structure

```
app/
  Http/Controllers/   API endpoints (Auth, Admin, Catalog, Stock, Order, Purchasing, Dashboard, Report)
  Http/Middleware/    Login and per-route permission checks
  Services/           Business rules: Inventory (reorder point, safety stock, FEFO), Stock,
                      Alerts, Perms, Settings, Audit
  Support/            Small helpers (Db, Clock, HttpError, V)
database/
  migrations/         Database schema
  seeders/            Case-study demo data
routes/
  api.php             All API routes and their permissions
  web.php             Serves the React app
src/                  React app: pages/, components/, auth/, lib/, styles/
public/               brand/ (logos), media/ (login background), built app in public/spa
tests/                API tests
docs/                 Test cases, bug reports, user guide, ERD
.github/              Pull request template, issue template, code owners
```

Backend work touches `app/` and `routes/api.php`, database work touches `database/`, frontend work touches `src/`, and QA work touches `tests/` and `docs/`. Keeping each person in their own folders keeps merge conflicts rare. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full team workflow.

---

## How the Inventory Logic Works

| Figure | Definition |
|---|---|
| **On hand** | Units physically in batches |
| **Reserved** | Units on pending or picking sales orders |
| **Available** | In-date on-hand minus reserved. The **only** figure sales may sell against |

- A **sale** raises *reserved* (so *available* drops immediately).
- **Completing a pick** lowers *on-hand* and releases the reservation at the same moment.
- **Receiving a shipment** creates a new batch with its own expiry date.
- A **physical count** that differs from the system opens a discrepancy alert. Stock is changed only after it is reviewed.
- **Reorder point** = average daily usage × lead time + safety stock. For seasonal items, usage is multiplied by the season multiplier starting one lead time before the season opens.
- **Safety stock** = *z* (1.65 by default) × standard deviation of daily demand × √lead time, using the last 90 days of picks. Items with under 14 days of history use a manual value.
- **Maximum stock**: a purchase order that would push stock above the limit is rejected.

---

## API Endpoints

All endpoints are under `/api`, JSON in and out. Every route except login, register and health requires a signed-in user, and each route checks a permission.

| Area | Endpoints |
|---|---|
| **Auth** | `POST auth/login` · `POST auth/logout` · `GET auth/me` · `POST auth/register` · `PATCH auth/account` · `POST auth/account/password` · `POST/DELETE auth/account/photo` · `GET auth/photo/{id}` |
| **Admin** | `GET/POST admin/users` · `PATCH admin/users/{id}` · `POST admin/users/{id}/reset-password` · `GET admin/roles` · `PUT admin/roles/{role}/permissions` · `GET admin/logs` · `GET/PUT admin/settings` |
| **Catalog** | `GET availability` · `GET/POST products` · `GET products/{sku}` · `PUT/DELETE products/{id}` · `GET batches` · `GET batches/{id}` · `GET movements` · `POST movements/transfer` |
| **Counts, adjustments, alerts** | `GET/POST counts` · `GET counts/worksheet` · `POST counts/{id}/investigate` · `POST counts/{id}/resolve` · `GET/POST adjustments` · `POST adjustments/{id}/approve` · `POST adjustments/{id}/reject` · `GET alerts` · `POST alerts/state` |
| **Sales and fulfillment** | `GET/POST sales-orders` · `GET sales-orders/{id}` · `POST sales-orders/{id}/cancel` · `GET pick-orders` · `POST pick-orders/{id}/start` · `POST pick-orders/{id}/complete` · `GET outgoing` · `POST outgoing/{id}/ship` |
| **Purchasing** | `GET reorder` · `GET/POST suppliers` · `GET/PUT suppliers/{id}` · `GET/POST purchase-orders` · `GET purchase-orders/{id}` · `POST purchase-orders/{id}/send` · `POST purchase-orders/{id}/cancel` · `GET purchase-history` · `GET incoming` · `GET incoming/{id}` · `POST incoming/{id}/receive` |
| **Dashboard and reports** | `GET dashboard` · `GET badges` · `GET reports` · `GET reports/{group}/{key}` |

---

## Team

| Role | Team member | Responsibilities | Works in |
|---|---|---|---|
| Project Manager / Team Lead | Moro, Samuel P. | Oversees the timeline, coordinates the team, manages the task board, reviews and merges pull requests, owns the repository | `README.md`, `CONTRIBUTING.md`, `.github/`, project scaffold |
| Backend Developer | Ordonia, Cholo Andrew | Implements server-side logic, API endpoints and the business rules for stock, orders, purchasing and alerts | `app/`, `routes/` |
| Frontend / UI Developer | Morasa, Desiree O. | Builds the user interface, forms and views for the dashboard, inventory, sales, purchasing and warehouse workspaces | `src/`, `public/brand`, `public/media` |
| Database Administrator | Maño, Cornelio Jr. | Designs and manages the database schema, migrations, seed data and table relationships | `database/`, `docs/database/` |
| QA and Documentation Lead | Nuqui, Jan Cedric T. | Tests functionality, tracks bugs, and prepares the documentation and user guide | `tests/`, `docs/` |

**Adviser:** Prof. Joseph D. Cartagenas · **Section:** 3CS-B · University of Cabuyao (Pamantasan ng Cabuyao), College of Computing Studies

---

## Contributing

We work on short-lived branches and merge through pull requests. Nobody pushes directly to `main`. Read **[CONTRIBUTING.md](CONTRIBUTING.md)** for who pushes what, the exact Git commands, commit message format and the review process.

---

## Useful Commands

```bash
php artisan migrate:fresh --seed   # reset the database to demo data
php artisan route:list             # see every route
php artisan serve                  # start the Laravel server on :8000
npm run dev                        # Vite dev server on :5173 with hot reload
npm run build                      # build the React app into public/spa
npm run test:api                   # run the API tests
```

> Demo data and demo accounts are for coursework only. Do not deploy them with real credentials.
