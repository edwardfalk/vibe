# Ticketing System: Backup & Recovery Guide

**[DEPRECATED]**

The automatic backup feature has been removed. Ticket updates and deletes no longer create backups. Please use version control or manual copies for backup if needed.

---

## Current State
- Ticket updates and deletes are immediate and final.
- No automatic backup or recovery is performed by the system.
- All other ticketing features (API, validation, scripts) remain fully functional.

## Manual Backup (if needed)
- You can still use the `scripts/backup-tickets.js` script to create a full zip backup of all tickets:

```sh
bun run scripts/backup-tickets.js
```
- The zip file will be saved in `/backups/` with a timestamped name.

## Ticket Validation
- Use the script `scripts/validate-tickets.js` to scan all tickets for JSON validity and required fields:

```sh
bun run scripts/validate-tickets.js
```
- Any corrupt or invalid tickets will be listed in the output.

---

For more details, see the main ticketing documentation.