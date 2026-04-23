# Naturalisation Tracker

A community-run web app that aggregates **UK naturalisation (Form AN) processing timelines** so applicants can see typical patterns: how long others waited between key milestones, how volumes vary by month, and how website submissions compare to data pulled from Reddit threads.

It is **not** an official Home Office service. Figures are based on voluntary or imported reports; they help set expectations, not predict any individual decision.

## What you can do

- **Dashboard** — Totals, median and percentile wait times (application to approval), monthly processing rates, split between website and Reddit-sourced rows, and transparency notes (e.g. removed entries, last update).
- **Submit** — Add an anonymous timeline (optional display name), with duplicate protection and basic profanity filtering on names.
- **Data explorer** — Browse submitted rows with source labels.
- **About** — Scope, methodology, and limitations in plain language.

Operators with an admin account can moderate entries (remove spam or clearly false rows) and configure Reddit thread imports (URLs, sync interval, manual sync). Imported Reddit rows are labelled and treated as unverified.

## How data is handled (summary)

- Focus: Form AN only; dates are day/month/year.
- Website submissions are community-reported; Reddit imports are automated and marked accordingly.
- Admins can remove inappropriate or false entries.

## Technical overview

| Area | Choice |
|------|--------|
| App | Next.js (App Router, TypeScript), GOV.UK Frontend styling |
| Data | MariaDB via Prisma |
| Auth | Admin area uses JWT (username/password stored hashed) |

Application code lives under **`web/`**. Prisma schema and API routes are part of that package.

## Local development

From `web/`:

```bash
npm install
# Configure DATABASE_URL (and ADMIN_JWT_SECRET for admin routes) in web/.env
npx prisma generate
npx prisma db push   # or migrate, per your workflow
npm run dev
```

Open the app at the URL Next.js prints (usually `http://localhost:3000`).

## First admin user (any environment)

Create an `AdminUser` row with a bcrypt `passwordHash`. From the repo root or `web/`:

```bash
node -e "require('bcryptjs').hash('your-password',10).then(console.log)"
```

Insert the hash and your chosen `username` into the `AdminUser` table (e.g. Prisma Studio or SQL).

## Deployment

Production notes for **Git + Plesk** (app root, env vars, hooks, troubleshooting) are in **[docs/deployment-plesk.md](docs/deployment-plesk.md)**. The post-deploy hook used there is **`scripts/plesk-post-deploy.sh`**.

Minimum production environment:

- `DATABASE_URL` — MariaDB connection string  
- `ADMIN_JWT_SECRET` — long random secret for admin JWTs  
- `NODE_ENV=production`  

`PORT` is usually set by the host.

Optional realtime-stat tuning (for "Who can expect approvals?"):

- `EXPECT_APPROVALS_RECENT_LOOKBACK_DAYS` — default `21` (allowed 7-60)
- `EXPECT_APPROVALS_RECENT_MIN_COUNT` — default `8` (allowed 3-50)
- `EXPECT_APPROVALS_RECENT_P_LOW` — default `25` (allowed 1-49)
- `EXPECT_APPROVALS_RECENT_P_HIGH` — default `75` (allowed `P_LOW+1` to 99)
