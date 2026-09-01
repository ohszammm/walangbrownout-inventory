# Team Contribution Guide

This document explains how the five of us each push real, meaningful work to
this repository, so the GitHub history genuinely reflects that everyone
built part of the system - not just one person.

**How this is set up:** Samuel has pushed a working *scaffold* as the first
commit on `main`. Routing, state management, and the build config are real
and working. Every file someone else owns is a small `TODO` placeholder
(a plain div that says whose job it is) - just enough that `npm run build`
succeeds and the app runs, but with nothing real built yet. Your job is to
replace your placeholder(s) with the real implementation, which already
exists (Samuel has the finished reference version) - you're not building it
from scratch blind, you're bringing in working code, testing it yourself,
and pushing it under your own name so you can explain it.

**Please actually do this yourself:** clone the repo, build your branch on
your own machine, run the app, click through your pages, and understand
what you're pushing. If anyone asks you about your part later, you should
be able to answer. Copy-pasting code you've never run isn't the point here.

---

## 1. Samuel: create and push the scaffold (one time)

```bash
cd walangbrownout-inventory   # this folder
git init
git add .
git commit -m "Initial project scaffold: routing, state, and business logic wired"
```

Create a new, empty repository on GitHub (no README/license from GitHub's
side, since you already have one), then:

```bash
git branch -M main
git remote add origin <your GitHub repo URL>
git push -u origin main
```

On GitHub: **Settings → Collaborators** → add Cornelio, Jan Cedric, Desiree,
and Cholo so they can push branches and open PRs.

---

## 2. One-time setup (everyone)

```bash
git clone <the repo URL Samuel gives you>
cd walangbrownout-inventory
git config user.name "Your Full Name"
git config user.email "your.github.email@example.com"
npm install
npm run dev
```

Confirm it runs at `http://localhost:5173` before doing anything else -
you should see TODO placeholders on most pages. That's expected.

---

## 3. Task assignments

| Member | Branch name | Files you own | What it covers |
|---|---|---|---|
| Moro, Samuel P. | *(scaffold, already on `main`)* | `src/App.jsx`, `src/main.jsx`, `src/utils/*`, `src/state/ItemsContext.jsx`, `src/data/items.js` | Routing, reorder-point formula, live alert derivation, shared item state |
| Maño, Cornelio Jr. | `feature/auth-login` | `src/auth/AuthContext.jsx`, `src/auth/RequireAuth.jsx`, `src/pages/Login.jsx` | Mock login/logout, route guarding |
| Nuqui, Jan Cedric T. | `feature/design-system` | `src/components/UI.jsx`, `src/components/LiveClock.jsx`, `src/components/Layout.jsx`, `src/styles/global.css` | Shared UI kit, sidebar nav, live clock, design tokens |
| Morasa, Desiree O. | `feature/inventory-batches` | `src/pages/Inventory.jsx`, `src/pages/Batches.jsx`, `src/pages/ItemDetail.jsx` | Item list, batch tracking (FEFO), item detail + pick action |
| Ordonia, Cholo Andrew | `feature/overview-alerts` | `src/pages/Overview.jsx`, `src/pages/Alerts.jsx`, `src/pages/Receiving.jsx` | Dashboard summary, alert resolution, receiving form |

**Important:** only edit files in your own row. If you think a shared file
(like `App.jsx`) needs to change, message Samuel first - that avoids
conflicts between branches.

---

## 4. Merge order (please follow this)

1. **Jan Cedric merges first.** Everyone else's real pages import shared
   components from `src/components/UI.jsx` (`Card`, `PageHeader`, `Pill`,
   `KpiTile`, `StockBar`, etc.) and rely on `global.css` for how anything
   looks. Until this PR merges, your own page will run but look unstyled -
   that's fine, keep building.
2. **Everyone else, in any order** - Cornelio, Desiree, Cholo can work in
   parallel.
3. Right before you open your PR, pull the latest `main` into your branch
   so you have Jan Cedric's real design system:
   ```bash
   git checkout your-branch-name
   git pull origin main
   ```

---

## 5. Where to get your real code

Samuel has the finished, working version of the whole app (the same one
already tested and confirmed working). Ask him for the reference copy -
he'll send you the specific files listed in your row of the table above.
Copy those files into your branch, replacing your TODO placeholder, then
**run it and click through it yourself** before committing - don't just
paste and push blind. If you spot something you'd genuinely improve, make
that change too; that's a real contribution, not just a copy-paste.

## 6. Workflow for each feature branch

```bash
git checkout main
git pull origin main
git checkout -b feature/your-branch-name
```

Replace your assigned TODO file(s) with the real implementation. **Commit
in a few small, meaningful steps, not one giant commit** - it should read
like real progress. For example, if you're Desiree:

```bash
# after building Inventory.jsx
git add src/pages/Inventory.jsx
git commit -m "Build Inventory page with class/FEFO/seasonal filters"

# after building Batches.jsx
git add src/pages/Batches.jsx
git commit -m "Add Batches page with FEFO pick order"

# after building ItemDetail.jsx
git add src/pages/ItemDetail.jsx
git commit -m "Add Item Detail page with working Pick action"
```

Before pushing, confirm it still builds:

```bash
npm run build
```

Then push and open a pull request:

```bash
git push -u origin feature/your-branch-name
```

On GitHub: **Compare & pull request** → base `main`, compare
`feature/your-branch-name` → write a short description of what you built →
**Create pull request**.

---

## 7. Reviewing and merging (Samuel)

For each incoming PR:
1. Pull the branch locally and run `npm run build` + `npm run dev` -
   click through the pages it touches.
2. Leave at least one real review comment or ask a question if something's
   unclear - this is normal and shows genuine review happened.
3. Merge via GitHub ("Squash and merge" or "Merge commit" - either is fine,
   just be consistent).
4. Delete the branch after merging.

---

## 8. Commit message convention

Keep it simple and descriptive - what changed, not "update" or "fix stuff":

- `Add Inventory page with class/FEFO/seasonal filters`
- `Wire Login form to AuthContext`
- `Add responsive sidebar navigation`
- `Fix reorder policy card alignment`

---

## 9. If you hit a merge conflict

This should be rare since everyone owns different files, but if it happens:

```bash
git checkout your-branch-name
git pull origin main
# Git will tell you which file(s) conflict - open them, look for
# <<<<<<< / ======= / >>>>>>> markers, resolve, then:
git add <the resolved file>
git commit
git push
```

If you're stuck, ask in the group chat before force-pushing anything.
