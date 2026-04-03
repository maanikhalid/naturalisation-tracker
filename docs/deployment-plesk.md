# Plesk deployment (Git)

Use this when deploying via Plesk's Git integration.

## Automatic `git pull` on every push (GitHub / GitLab / etc.)

Plesk can **pull when your remote receives a push** via a **webhook**:

1. In Plesk: **Domains** → your domain → **Git** → open the repository → **Repository settings** (or similar).
2. Copy the **webhook URL** Plesk shows (see [Plesk: webhooks for automatic pull](https://plesk.com/kb/docs/using-remote-git-hosting-use-webhooks-for-automatic-pull)).
3. On **GitHub**: repo **Settings** → **Webhooks** → **Add webhook** → paste that URL, content type `application/json`, events **Just the push event** (or as Plesk docs say).
4. Save. Each push triggers Plesk to pull; your **Additional deployment actions** (e.g. `bash scripts/plesk-post-deploy.sh`) run after the pull if configured.

If webhooks fail (e.g. SSL), see [webhook URL troubleshooting](https://plesk.com/kb/support/how-to-get-webhook-url-for-remote-git-repository-in-plesk).

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

#### Reddit sync: HTTP 403 from the server

Reddit often returns **403** (HTML, not JSON) for requests from **hosting / datacenter IPs**. Your laptop may work while **SSH `curl` on Plesk fails** with the same URL.

**Mitigation (this app):** set an outbound HTTP(S) proxy so Reddit traffic exits from a less-blocked network (e.g. residential proxy provider, or a small VPS IP that Reddit still allows). Only **Reddit** fetches use this (not your whole app) if you use the dedicated variable:

- **`REDDIT_HTTPS_PROXY`** — preferred. Example: `http://user:pass@proxy.example.com:8080`
- **`HTTPS_PROXY` / `HTTP_PROXY`** — used if `REDDIT_HTTPS_PROXY` is unset (may affect other libraries; prefer `REDDIT_HTTPS_PROXY`).

After setting the variable, restart the Node app and use admin **Test fetch only** or `bash scripts/reddit-curl-check.sh` with the same proxy in the environment.

**Alternatives:** run sync from a scheduled job on a non-blocked machine that calls your admin API, or use Reddit’s official API with credentials (still subject to IP reputation).

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

#### Troubleshooting: `EACCES` / `permission denied` during `npm ci`

If **`node_modules`** was ever created by **root** (e.g. you ran `npm` as root over SSH) but deploy runs as the **subscription system user**, npm cannot remove or update caches under **`web/node_modules`**.

As **root**, fix ownership for the whole site tree (replace user/group with your subscription; `psacln` is common for web content):

```bash
chown -R SUBSCRIPTION_SYSTEM_USER:psacln /var/www/vhosts/YOUR_DOMAIN/httpdocs/naturalisation-tracker
```

Then run **`npm ci`** / **`bash scripts/plesk-post-deploy.sh`** as that subscription user only, not as root, so new files stay owned correctly.

The deploy hook uses **`bash`**; if SSH is set to **`/bin/sh` only**, call **`bash scripts/plesk-post-deploy.sh`** explicitly or set the shell to **`/bin/bash`** for that subscription.

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
