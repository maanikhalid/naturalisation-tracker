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

### 3) Install dependencies and build — use the simplest option that matches your host

Plesk + Git hooks are a common source of pain: **Additional deployment actions** may run in a **chroot** with no `/usr/bin/env`, no `/opt/plesk` in `PATH`, and **`HOME=/`**, while SSH as root works fine. Official and community guidance is to **avoid fighting that in a giant shell script** and use one of these instead.

#### Option A — Plesk Node.js UI (simplest, no Git hook)

Use the **Node.js** screen for the domain (see [Plesk: hosting Node.js applications](https://docs.plesk.com/en-US/obsidian/administrator-guide/website-management/hosting-nodejs-applications.76652/)):

1. **Application root** = `httpdocs/web` (this project).
2. Use **NPM install** (or equivalent) from the panel so Plesk runs `npm` with the correct Node version.
3. Add a **package.json script** or **Run script** step to run **`build`** after install if the panel supports it, or run **`npx prisma generate`**, **`npx prisma db push`**, and **`npm run build`** from **SSH** once after each deploy (see Option B).

Leave **Git “Additional deployment actions” empty** if you use this path.

#### Option B — Git deploy + SSH that is not chrooted (recommended if you want a hook)

1. In **Hosting / SSH access**, enable SSH with **`/bin/bash`** and **not** chrooted (same pattern as [common Next.js on Plesk write-ups](https://www.hennio.dev/github-cicd-nextjs-on-plesk/)).
2. In Git, **Additional deployment actions** (repository root):

   ```bash
   bash scripts/plesk-post-deploy.sh
   ```

3. Optional: on the server only, create **`naturalisation-tracker/.plesk-deploy-env.sh`** (gitignored) to extend `PATH` or set env vars, for example:

   ```bash
   export PATH="/opt/plesk/node/22/bin:/usr/bin:/bin:$PATH"
   ```

The script is intentionally short: `npm ci`, Prisma generate/push, `npm run build` under `web/`.

#### Option C — CI builds, server only runs the app

Build in **GitHub Actions** (or similar) and deploy the built app or `standalone` output; the server does not need `npm` in a Git hook. See for example [GitHub CI/CD Next.js on Plesk](https://www.hennio.dev/github-cicd-nextjs-on-plesk/).

#### If you must use a chrooted Git hook

Do not rely on `/usr/bin/npm` or the stock `bin/npm` wrapper (`#!/usr/bin/env`). Vendor a **Linux x64** [Node binary](https://nodejs.org/en/download/) under **`httpdocs/.../naturalisation-tracker/tools/node/`** (host path like `/var/www/vhosts/<domain>/httpdocs/naturalisation-tracker/tools/node`), or put **`export PATH=...`** / **`node` + `npm-cli.js` paths** in **`.plesk-deploy-env.sh`**. `tools/node/` is gitignored and may be removed on deploy unless you restore it after each pull.

**Related:** [Plesk KB: `usr/bin/env: node: No such file or directory`](https://www.plesk.com/kb/support/unable-to-use-npm-install-for-node-js-application-in-plesk-usr-bin-env-node-no-such-file-or-directory), [forum: npm in Git deploy actions](https://talk.plesk.com/threads/npm-build-actions-in-deploy-actions-w-the-git-extension.393283/).

`npm run deploy:plesk` in `web/package.json` can replace the separate prisma + build commands in custom setups.

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
