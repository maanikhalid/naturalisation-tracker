# Naturalisation Tracker

Community tracker for UK Naturalisation (Form AN) processing timelines.

## Stack

- Next.js (App Router, TypeScript)
- GOV.UK Frontend styles/components
- MariaDB (via Prisma)
- Git-based deployment via Plesk

## Features implemented

- Anonymous submission with optional username
- Duplicate protection (`username + applicationDate`)
- Username bad-word filtering
- Timeline status support including `CEREMONY_PENDING`
- Dashboard with:
  - total submissions
  - median and percentile metrics
  - monthly processing rates
  - source split (`WEBSITE` vs `REDDIT`)
  - transparency metrics (removed count + last update)
- Data explorer table with source labels
- Admin JWT login (username/password)
- Admin moderation: remove entries
- Admin "Reddit Tracking" settings:
  - add multiple thread URLs
  - sync interval value per thread
  - manual sync endpoint
  - imported rows marked `REDDIT` and `isVerified=false`

## Create first admin user

Use Prisma Studio or SQL to insert an `AdminUser` row with a bcrypt hash.
You can generate hash quickly in Node:

```bash
node -e "require('bcryptjs').hash('your-password',10).then(console.log)"
```

Then insert:

- `username`: your admin username
- `passwordHash`: generated hash

## Plesk deployment with Git

Use this when deploying via Plesk's Git integration.

### 1) Plesk app setup

- Create a Node.js app in Plesk.
- Set **Application root** to `httpdocs/web` (not just `httpdocs`).
- Set **Application mode** to `production`.
- Set **Document root** to `httpdocs/web`.
- Set **Application startup file** to `app.js`.

If you see `The file does not exist` for startup file, your app root is wrong.
The startup file exists at `httpdocs/web/app.js` in this project.

### 2) Environment variables in Plesk

Add these in Node.js app environment settings:

- `DATABASE_URL` (MariaDB connection string)
- `ADMIN_JWT_SECRET` (long random secret)
- `NODE_ENV=production`
- `PORT` (optional; Plesk usually sets this)

Example:

```bash
DATABASE_URL="mysql://db_user:db_password@localhost:3306/db_name"
```

### 3) Git deployment actions

Plesk may invoke hooks with `sh`, which breaks bash-only options and differs from your SSH session. **Call bash explicitly** and run from the **repository root**.

**Recommended — repo script**

```bash
bash scripts/plesk-post-deploy.sh
```

The script exports a sane `PATH` (including `/usr/bin` and common `/opt/plesk/node/*/bin` locations), then runs `npm ci`, Prisma generate/push, and `npm run build` under `web/`.

**If `npm` is still not found in the hook**, use absolute `npm` / `npm --prefix` (replace paths with yours):

```bash
PATH=/usr/bin:/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:$PATH /usr/bin/npm --prefix /var/www/vhosts/YOUR_DOMAIN/httpdocs/naturalisation-tracker/web ci --include=dev --no-audit --no-fund && PATH=/usr/bin:/bin:/opt/plesk/node/25/bin:/opt/plesk/node/24/bin:$PATH /usr/bin/npm --prefix /var/www/vhosts/YOUR_DOMAIN/httpdocs/naturalisation-tracker/web run build
```

Optional: `npm run deploy:plesk` in `web/package.json` chains Prisma generate, `db push`, and `next build` in one script if you prefer that over the shell steps.

### 4) First deploy checklist

- Ensure MariaDB database and user are created in Plesk.
- Verify `DATABASE_URL` is reachable from the Node.js app.
- Run a deploy from Git in Plesk.
- Restart the Node.js app in Plesk after deploy.

### 5) Create admin user in production

Generate password hash:

```bash
node -e "require('bcryptjs').hash('your-password',10).then(console.log)"
```

Insert into database `AdminUser` table:

- `username`
- `passwordHash`
