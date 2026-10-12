# Team Workflow: How We Use Git and GitHub

This guide explains **who pushes what, in what order, and exactly how**. Everyone follows it, including the Team Lead.

## 1. Who owns what

| Role | Member | Pushes (owns) | Branch prefix |
|---|---|---|---|
| Project Manager / Team Lead | Moro, Samuel P. | Project scaffold, `README.md`, `CONTRIBUTING.md`, `.github/` | `chore/`, `docs/` |
| Database Administrator | Maño, Cornelio Jr. | `database/migrations/`, `database/seeders/`, `docs/database/` (ERD) | `db/` |
| Backend Developer | Ordonia, Cholo Andrew | `app/`, `routes/api.php` | `backend/` |
| Frontend / UI Developer | Morasa, Desiree O. | `src/`, `public/brand/`, `public/media/`, favicons | `frontend/` |
| QA and Documentation Lead | Nuqui, Jan Cedric T. | `tests/`, `docs/` (test cases, bug reports, user guide), `.github/ISSUE_TEMPLATE/` | `qa/`, `docs/` |

**Rule of thumb:** you commit only inside your own folders. If you need a change in someone else's area, open a GitHub Issue and assign it to them (see section 8).

## 2. Branches

- `main` is protected. It always works and nobody pushes to it directly.
- All work happens on a short-lived branch created from the latest `main`, then merges back through a **pull request (PR)**.
- Branch name format: `<prefix>/<short-topic>`, in lowercase with dashes.

Examples: `db/create-inventory-tables`, `backend/reorder-point-logic`, `frontend/login-page`, `qa/api-test-cases`, `docs/user-guide`.

## 3. One-time setup by the Team Lead (Samuel)

### 3.1 Create the repository
1. On GitHub, create a new repository (for example `walangbrownout-inventory`). Set it to **Private** and add all members as collaborators (Settings, Collaborators, Add people, with **Write** access).
2. Do **not** let GitHub add a README or .gitignore. We already have them.

### 3.2 Push the scaffold (Phase 1)
Open a terminal inside the project folder (the one containing `artisan` and `composer.json`):

```bash
git config user.name  "Samuel P. Moro"
git config user.email "your-github-email@example.com"   # must match your GitHub account email

git init -b main
git add .gitignore README.md CONTRIBUTING.md .editorconfig .gitattributes .oxlintrc.json
git add .env.example artisan composer.json composer.lock package.json package-lock.json
git add vite.config.js index.html bootstrap/ config/ storage/ .github/
git add routes/web.php routes/console.php
git add public/index.php public/.htaccess public/robots.txt
git status                                   # check: no .env, vendor, node_modules or .sqlite files
git commit -m "chore: add project scaffold, README and team workflow"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
```

> The scaffold is the Laravel/Vite skeleton only. The team's parts are added by each member in sections 4.1 to 4.4.

### 3.3 Protect `main`
GitHub, Settings, Branches, Add rule for `main`:
- Require a pull request before merging, with **1 approval**.
- Require review from Code Owners.
- Do not allow force pushes or deletions.

Then edit `.github/CODEOWNERS` and replace the placeholder usernames with the real GitHub usernames.

### 3.4 Set up the task board
Create a GitHub **Project** (Board) with the columns `Backlog`, `In Progress`, `In Review`, `Done`. Create labels: `database`, `backend`, `frontend`, `qa`, `docs`, `bug`. Every task is an Issue assigned to its owner.

## 4. First upload of each member's part (in this order)

The code already exists, so each member uploads their own part through a PR. The order matters because later parts depend on earlier ones, so `main` becomes fully runnable after step 4.3.

| Order | Member | Branch | Add exactly these paths | Commit and PR title |
|---|---|---|---|---|
| 1 | Samuel | `main` | Scaffold (section 3.2) | `chore: add project scaffold` |
| 2 | Cornelio | `db/initial-schema` | `database/` (migrations, seeders, `.gitignore`), ERD in `docs/database/` | `feat(db): add inventory schema and demo seeders` |
| 3 | Cholo | `backend/initial-api` | `app/`, `routes/api.php` | `feat(api): add controllers, services and routes` |
| 4 | Desiree | `frontend/initial-ui` | `src/`, `public/brand/`, `public/media/`, `public/favicon.*`, `public/icons.svg` | `feat(ui): add React app, pages and styles` |
| 5 | Jan | `qa/initial-tests-docs` | `tests/`, `docs/` (test cases, user guide) | `test: add API tests and documentation` |

Each member follows the same steps (replace the branch name and paths with your own row from the table):

```bash
# one-time: tell Git who you are (must match your GitHub account)
git config user.name  "Your Name"
git config user.email "your-github-email@example.com"

# get the project
git clone https://github.com/<owner>/<repo>.git
cd <repo>
git pull origin main

# create your branch
git checkout -b db/initial-schema

# copy your part of the project into the repo folders, then stage ONLY your paths
git add database/ docs/database/
git status                                   # confirm only your files are listed
git commit -m "feat(db): add inventory schema and demo seeders"
git push -u origin db/initial-schema
```

Then on GitHub click **Compare and pull request**, fill in the template, and request a review. Samuel merges after approval (use **Squash and merge**).

## 5. Daily workflow (everyone)

```bash
# 1. Start from the newest main
git checkout main
git pull origin main

# 2. Create a branch for ONE task
git checkout -b backend/reorder-point-logic

# 3. Work and commit small and often
git add app/Services/Inventory.php           # add only the files you changed
git commit -m "feat(inventory): calculate safety stock from demand history"

# 4. Keep your branch up to date while you work
git fetch origin
git merge origin/main

# 5. Push and open a pull request
git push -u origin backend/reorder-point-logic
```

After your PR is merged:

```bash
git checkout main
git pull origin main
git branch -d backend/reorder-point-logic
```

### Running the project after pulling
```bash
composer install            # only if composer.json changed
npm install                 # only if package.json changed
php artisan migrate:fresh --seed   # after any database or seeder change
npm run build
```

## 6. Commit message format

`<type>(<optional area>): <what changed, in the present tense>`

| Type | Use for | Example |
|---|---|---|
| `feat` | New feature | `feat(sales): block orders above available stock` |
| `fix` | Bug fix | `fix(counts): keep discrepancy open after a recount` |
| `db` or `feat(db)` | Schema or seed changes | `feat(db): add alert_states table` |
| `test` | Tests | `test: add FEFO picking test` |
| `docs` | Documentation | `docs: add warehouse section to user guide` |
| `style` | UI or CSS only | `style(login): center the login button` |
| `chore` | Config, tooling | `chore: update .gitignore` |

Keep each commit about **one thing**. Good history shows each member's real contribution, so avoid one giant commit.

## 7. Pull requests and reviews

- **One task per PR**, small enough to review in a few minutes.
- Fill in the PR template: what changed, how to test it, and a screenshot for UI changes.
- **Reviewers:** GitHub auto-requests the code owner of the folder. Another teammate approves, and **Samuel merges**.
- Reviewers check: it runs, it follows the folder ownership, no secrets or build files are committed, the message format is followed.
- The author fixes review comments by pushing more commits to the same branch. Do not open a new PR.
- Merge with **Squash and merge**, then delete the branch.

## 8. Working across areas

| If you need... | Do this |
|---|---|
| A new table or column | Open an Issue labeled `database`, assign it to Cornelio. He adds the migration, then pull `main` |
| A new API endpoint or field | Issue labeled `backend`, assigned to Cholo |
| A new screen or UI change | Issue labeled `frontend`, assigned to Desiree |
| A bug found | Issue labeled `bug` with steps to reproduce (Jan triages and assigns it) |

Typical feature order: **database, then backend, then frontend, then QA**. Everyone can read any folder. Only the owner edits it.

## 9. Merge conflicts

Conflicts usually appear when two people edit the same file.

```bash
git fetch origin
git merge origin/main
# Git lists conflicted files. Open them and look for <<<<<<<, =======, >>>>>>>
# Keep the correct code, delete the markers, then:
git add <the conflicted files>
git commit
git push
```

If you are unsure which version is right, ask the file's owner before resolving it.

## 10. Never commit these

| Don't commit | Why |
|---|---|
| `.env` | Contains secrets and your local settings (already in `.gitignore`) |
| `vendor/`, `node_modules/` | Reinstalled with `composer install` and `npm install` |
| `database/database.sqlite` | Local data. Everyone recreates it with `php artisan migrate:fresh --seed` |
| `public/spa/` | Build output from `npm run build` |
| `storage/app/avatars/` | Uploaded profile photos |
| Passwords, API keys, personal data | Security |

Also: never force push (`git push --force`) to `main`, and never commit straight to `main`.

## 11. Quick reference

```bash
git status                       # what changed?
git diff                         # see the exact changes
git log --oneline -10            # recent history
git branch                       # list branches (the * is the current one)
git checkout <branch>            # switch branch
git stash / git stash pop        # temporarily set work aside
```

## 12. Checklist before opening a PR

- [ ] The branch started from the latest `main`
- [ ] I only changed files in my own folders
- [ ] `php artisan migrate:fresh --seed` works, and for UI work `npm run build` has no errors
- [ ] `npm run test:api` still passes (when the change touches the API)
- [ ] No `.env`, `vendor`, `node_modules`, `.sqlite` or `public/spa` files are staged
- [ ] My commit messages follow the format
- [ ] The PR description says what changed and how to test it
