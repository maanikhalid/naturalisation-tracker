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

#### Plesk chroot (SSH disabled for the system user)

If **SSH is disabled** (or restricted) for the subscription’s system user, Plesk may run Git **Additional deployment actions** inside a **chroot** whose root is that user’s home. In that environment:

- Paths like `/usr/bin`, `/opt/plesk`, and **Plesk’s Node** are often **outside the jail** and **cannot be executed**.
- Only files under the subscription (e.g. `httpdocs`, home dotfiles) are reliably available.

So the same script that works in an interactive SSH session as root can fail in the hook with **“npm not found”** even though Node exists on the server.

**Practical options:**

1. **Allow SSH without chroot** for that subscription (Plesk / host policy), so hooks see the real filesystem; or run deploy commands over full SSH instead of the Git hook.
2. Install **Node/npm inside the jail**, e.g. **nvm** under `$HOME` (`~/.nvm/.../bin/npm`). The deploy script prepends those paths first.
3. Put a **`.plesk-node-env.sh`** in the repo root on the server (gitignored) with `NPM=...` or `NODE_BIN=` + `NPM_CLI=` pointing to binaries **inside** the subscription.
4. **Build elsewhere** (CI) and deploy artifacts, and keep the hook minimal (no `npm` on server).

#### Command

Plesk may invoke hooks with `sh`. **Call bash explicitly** from the **repository root**:

```bash
bash scripts/plesk-post-deploy.sh
```

The script tries, in order: **`$HOME` / nvm**, optional **`.plesk-node-env.sh`**, then normal **`/opt/plesk`** and **`/usr`** paths (when not chrooted), then runs `npm ci`, Prisma generate/push, and `npm run build` under `web/`.

**Server-only override** (not in git; path is in `.gitignore`):

```bash
# naturalisation-tracker/.plesk-node-env.sh — paths must exist inside chroot if applicable
export NPM=/path/to/npm
# or:
# export NODE_BIN=/path/to/node
# export NPM_CLI=/path/to/npm-cli.js
```

**Non-chroot one-liner** (replace domain and paths; useless inside a strict chroot):

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
