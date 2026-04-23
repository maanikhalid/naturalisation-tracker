# Data Script Undo Guide

This file explains how to undo approval-date modification scripts safely.

## Before You Run Any Apply Script

1. Always run a dry run first.
2. Keep the JSON output from apply scripts.
3. Copy the printed `backupPath` value and store it.

All commands below assume you are in `web/`.

---

## December 2025 Closeoff (with undo)

### Apply

```bash
npm run close:december-pending:dry
npm run close:december-pending
```

### Undo

```bash
node scripts/undo-december-closeoff-from-backup.mjs --backup "scripts/backups/dec-2025-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --dry-run
node scripts/undo-december-closeoff-from-backup.mjs --backup "scripts/backups/dec-2025-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --apply
```

---

## October 2025 Closeoff (with undo)

### Apply

```bash
npm run close:october-pending:dry
npm run close:october-pending
```

### Undo

```bash
node scripts/undo-october-closeoff-from-backup.mjs --backup "scripts/backups/oct-2025-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --dry-run
node scripts/undo-october-closeoff-from-backup.mjs --backup "scripts/backups/oct-2025-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --apply
```

---

## January 2026 Closeoff (with undo)

### Apply

```bash
npm run close:january-pending:dry
npm run close:january-pending
```

### Undo

```bash
node scripts/undo-january-closeoff-from-backup.mjs --backup "scripts/backups/jan-2026-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --dry-run
node scripts/undo-january-closeoff-from-backup.mjs --backup "scripts/backups/jan-2026-closeoff-backup-YYYYMMDD-HHMMSSZ.json" --apply
```

---

## November 2025 Closeoff

The current November script (`close-off-november-pending.mjs`) does not create backup files.

If you already ran the November apply script, undo options are:

1. Restore from a DB snapshot/backup taken before the run, or
2. Manually patch affected rows by ID if you logged output externally.

Recommended next step: replace the November script with a backup-enabled version before running it again.

---

## Find Latest Backup Quickly

```bash
ls -1t scripts/backups | head
```

Pick the relevant backup filename and pass it to the undo command.
