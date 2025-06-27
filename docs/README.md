# Ticketing System (Vibe)

## Current State (June 2025)
- Ticket updates and deletes are immediate and final. There is **no automatic backup**.
- All ticket operations are handled via the REST API (`localhost:3001`).
- Tickets are stored as JSON files in `tests/bug-reports/`.
- Use `scripts/backup-tickets.js` for manual full backup (creates a zip in `/backups/`).
- Use `scripts/validate-tickets.js` to check ticket integrity.
- All other ticketing features (API, validation, scripts) are fully functional.

## Manual Backup
- Run: `bun run scripts/backup-tickets.js`
- Output: `/backups/tickets-backup-<timestamp>.zip`

## Validation
- Run: `bun run scripts/validate-tickets.js`
- Output: List of any corrupt/invalid tickets.

## No Automatic Recovery
- If you delete or update a ticket, it is permanent unless you have a manual backup.

---

For more, see `docs/TICKETING_BACKUP_AND_RECOVERY.md` and `docs/TICKETING_SYSTEM_GUIDE.md`.