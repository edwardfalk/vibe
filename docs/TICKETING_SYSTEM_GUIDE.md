# Ticketing System Guide

> **Purpose:**  
> This guide documents the modular ticketing system: schema, API, workflows, and best practices.  
> For rules, see [.cursorrules](../.cursorrules).

> **This document is the authoritative reference for Vibe's modular ticketing system.**
> For architecture and coding standards, see the main `README.md` and `.cursorrules`.

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
  "history": [
    { "status": "open", "timestamp": "2024-06-01T12:00:00Z" }
  ],
  "artifacts": [
    "2024-06-01T12-00-00_BR-2024-06-01-modal-bug-001_screenshot.png"
  ],
  "relatedTickets": [],
  "createdAt": "2024-06-01T12:00:00Z",
  "updatedAt": "2024-06-01T12:00:00Z"
}
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
- If you create a ticket JSON file directly (due to backend downtime), ensure it follows the schema and folder structure. When the backend is available, use the API to register the ticket and move artifacts if needed. Mark the migration in the ticket’s `history` array.
- Reference this guide for updates and troubleshooting.

---

## 9. References

- [README.md](../README.md)
- [.cursorrules](./.cursorrules)
- [MCP_TOOLS_GUIDE.md](./MCP_TOOLS_GUIDE.md)
- [MCP_PLAYWRIGHT_TESTING_GUIDE.md](./MCP_PLAYWRIGHT_TESTING_GUIDE.md)

---

*Last updated: 2024-06-01*
