# Ticketing System Guide

## 🚀 Quick Reference

**Create a ticket:**
```sh
bun run ticket:create type=bug title="My bug" tags=ai,urgent checklist='["step1","step2"]'
```
**Update a ticket:**
```sh
bun run ticket:update id=BUG-... status=closed
```
**Get a ticket:**
```sh
bun run ticket:get id=BUG-...
```
**List all tickets:**
```sh
bun run ticket:list
```
**Check off a checklist step:**
```sh
bun run ticket:check id=BUG-... step="step1" result="Passed"
```
**Get the latest/focused ticket:**
```sh
bun run ticket:latest
```
**Set a ticket as focus:**
```sh
bun run ticket:update id=BUG-... tags=focus,ai,testing
```

**Ticket ID format:**
- Always: `<TYPE>-<YYYY-MM-DD>-<random6>` (e.g., `BUG-2024-06-11-abc123`)

**Ambiguity rules:**
- If a ticket is tagged `focus` and not closed, it is always considered the "active" ticket.
- If no ticket is focused, the most recently updated, not closed ticket is used.
- If all are closed, you get a clear message.

---

## 1. Overview

The ticketing system is a core, modular subsystem for tracking bugs, features, enhancements, and tasks. It is designed for:

- **Automation:** Integrates with probe-driven Playwright tests and bug-report watcher scripts.
- **Metadata-rich tickets:** All tickets are structured JSON files with essential metadata.
- **Artifact management:** Screenshots, logs, and follow-ups are grouped per ticket.
- **Accessibility:** All ticket actions are available via UI and keyboard shortcuts.

---

## 2. File Structure & Storage

- **Tickets:** Stored as JSON files in `tests/bug-reports/`.
- **Artifacts:** (screenshots, logs) are saved in the same folder as their ticket, auto-moved by `move-bug-reports.js`.
- **Folder Structure:**
  - Each ticket (bug, feature, enhancement, task) must have its own folder:
    ```
    tests/bug-reports/[ISO timestamp]_[ticket ID]_[short title]/
    ```
  - The main ticket JSON file must be named:
    ```
    [ticket ID].json
    ```
    Example:
    ```
    tests/bug-reports/2024-06-01T12-00-00_TASK-2024-06-01-auto-resume-ocr/
      └── TASK-2024-06-01-auto-resume-ocr.json
    ```
  - All artifacts (screenshots, logs, follow-ups) must be saved inside this folder, referenced in the `artifacts` array.
  - Follow-up artifacts/reports: Saved as subfolders or files within the parent ticket folder, referencing the same ID.

---

## 3. Ticket Format (JSON Schema)

Each ticket must include:

- `id` (unique, short)
- `type` (`bug`, `feature`, `enhancement`, `task`)
- `title` (concise, human-readable)
- `status` (e.g., `open`, `in-progress`, `closed`)
- `tags` (array)
- `history` (array of status/assignment changes)
- `artifacts` (array of file paths)
- `relatedTickets` (array of ticket IDs)
- `createdAt`, `updatedAt` (ISO timestamps)

**Example:**

```json
{
  "id": "BR-2024-06-01-modal-bug-001",
  "type": "bug",
  "title": "Bug report modal does not close after submission",
  "status": "open",
  "tags": ["UI", "modal", "accessibility"],
  "history": [{ "status": "open", "timestamp": "2024-06-01T12:00:00Z" }],
  "artifacts": [
    "2024-06-01T12-00-00_BR-2024-06-01-modal-bug-001_screenshot.png"
  ],
  "relatedTickets": [],
  "createdAt": "2024-06-01T12:00:00Z",
  "updatedAt": "2024-06-01T12:00:00Z"
}
```

## 3a. Multi-Step Tickets & Checklists

**Tickets can include a checklist field for multi-step actions, plans, or verification sequences.**

### Checklist Structure
- `checklist`: Array of steps, each as an object: `{ step, done, result, timestamp }`
- Example:
  ```json
  "checklist": [
    { "step": "Reproduce bug", "done": true, "result": "Confirmed", "timestamp": "2024-06-09T15:00:00Z" },
    { "step": "Fix bug", "done": false, "result": null, "timestamp": null },
    { "step": "Verify fix", "done": false, "result": null, "timestamp": null }
  ]
  ```

### CLI Usage
- **Create a ticket with checklist:**
  ```sh
  bun run ticket:create type=bug title="Test ticket" checklist='["Reproduce bug","Fix bug","Verify fix"]'
  ```
- **Check off a step:**
  ```sh
  bun run ticket:check id=BUG-... step="Reproduce bug" result="Confirmed"
  ```
- **Update checklist (advanced):**
  ```sh
  bun run ticket:update id=BUG-... checklist='[{"step":"Fix bug","done":true,"result":"Patched","timestamp":"2024-06-09T15:10:00Z"}]'
  ```

### Best Practices
- Use checklists to plan, track, and verify multi-step tickets.
- Each step can be checked off with a result and timestamp.
- AI and automation should always update and confirm checklist progress.
- Use `bun run ticket:get id=...` to see current checklist status.

## 3b. Getting the Latest or Focused Ticket

**To always get the right ticket (for AI or devs):**

- Use the `latest` CLI command:
  ```sh
  bun run ticket:latest
  ```
- This will:
  1. Return the ticket tagged with `focus` (and not closed), if any.
  2. If none, return the most recently updated, not closed ticket.
  3. If all are closed, print "No active tickets found."
- The CLI prints a message indicating which logic was used (focus or fallback).

### How to Set/Unset Focus
- To set a ticket as "in focus":
  ```sh
  bun run ticket:update id=BUG-... tags=focus,ai,testing
  ```
- To remove focus, update the ticket without the `focus` tag:
  ```sh
  bun run ticket:update id=BUG-... tags=ai,testing
  ```
- Only one ticket should be in focus at a time for clarity. If multiple are focused, the most recently updated is used and a warning is printed.

### Why This Avoids Ambiguity
- "Latest" means "the one you are working on" if you set focus, not just the most recent.
- If you don't set focus, you still get the most recently updated, not closed ticket.
- If all are closed, you get a clear message.

### Example
```sh
bun run ticket:update id=BUG-123 tags=focus,ai,testing
bun run ticket:latest
# Output: Returning focused ticket: BUG-123
```

---

## 4. API & Module Usage

- **ticketManager.js:** Main JS module for ticket creation, updates, and queries.
- **ticket-api.js:** Backend API for ticket CRUD operations. All tickets must be created/updated via this API.
- **ID Requirement:** All tickets must include a unique `id`—the backend will reject tickets without it.
- **Artifacts:** Attachments (screenshots, logs) must be referenced in the `artifacts` array and saved in the ticket's folder.
- **Ticket Creation Workflow:**
  - **Preferred:** Always use the ticket API (`ticketManager.js` or `/api/tickets`) to create, update, or query tickets. This ensures unique IDs, correct metadata, and proper artifact handling.
  - **Fallback:** If the backend server is not running, you may create a ticket JSON file directly in `tests/bug-reports/`. When the server is available, migrate or register these tickets via the API.
  - **Automation:** Automated scripts and Playwright probes must use the API when possible. If not, log a warning and save the ticket as a JSON file for later reconciliation.

**Example (JS):**

```js
import { createTicket } from './js/ticketManager.js';

const ticket = {
  id: 'BR-2024-06-01-modal-bug-001',
  type: 'bug',
  title: 'Bug report modal does not close after submission',
  // ...other fields
};

createTicket(ticket);
```

---

## 5. Automation & Workflows

- **Probe-driven tests:** On failure, automatically capture screenshot/log, retry, and create a ticket if the issue persists.
- **Bug-report watcher:** `move-bug-reports.js` auto-moves artifacts to the correct folder.
- **Follow-ups:** Additional screenshots or follow-up reports must reference the original ticket ID and be saved in the same parent folder.

---

## 6. UI & Accessibility

- **Open bug-report modal:**
  - Press `B` + `R` keys together
  - Or click the UI "Report Bug" button
- **Keyboard shortcuts in modal:**
  - `Enter`/`Ctrl+Enter`: Save report
  - `Escape`: Cancel/close modal
- **AI access:** The AI can programmatically open the modal and access the same data as a human tester.

---

## 7. Known Issues & Troubleshooting

- **Modal not closing after submission:**
  - Tracked as bug ticket `BR-2024-06-01-modal-bug-001`.
  - See README for troubleshooting steps.
- **Artifacts not moved:** Ensure `move-bug-reports.js` is running.
- **ID collision:** Always generate unique IDs for new tickets.

---

## 8. Best Practices

- Use concise, metadata-rich tickets—avoid verbose text.
- Always use the API and modules for ticket operations.
- Group all related artifacts and follow-ups under the same ticket folder.
- Follow required fields and naming conventions:
  - `id`: Unique, short, and prefixed by type (e.g., `TASK-`, `BR-`, `FEAT-`, `ENH-`)
  - `type`: One of `bug`, `feature`, `enhancement`, `task`
  - `title`: Concise, human-readable
  - `status`: `open`, `in-progress`, `closed`, etc.
  - `tags`: Array of relevant tags
  - `history`: Array of status/assignment changes
  - `artifacts`: Array of file paths (relative to ticket folder)
  - `relatedTickets`: Array of ticket IDs
  - `createdAt`, `updatedAt`: ISO timestamps
- If you create a ticket JSON file directly (due to backend downtime), ensure it follows the schema and folder structure. When the backend is available, use the API to register the ticket and move artifacts if needed. Mark the migration in the ticket's `history` array.
- Reference this guide for updates and troubleshooting.

---

## 9. References

- [README.md](../README.md)
- [.cursorrules](./.cursorrules)
- [MCP_TOOLS_GUIDE.md](./MCP_TOOLS_GUIDE.md)
- [MCP_PLAYWRIGHT_TESTING_GUIDE.md](./MCP_PLAYWRIGHT_TESTING_GUIDE.md)

---

_Last updated: 2024-06-01_
