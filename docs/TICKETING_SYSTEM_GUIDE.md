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

### Common Gotchas

- **Tags parsing:** The CLI will split a `tags=` value on commas *only if the value is **not** wrapped in quotes*.  
  - ✅ `tags=ai,workflow` → `["ai","workflow"]`  
  - ⚠️ `tags="ai,workflow"` → `"ai,workflow"` (single string).  
  - If you need quotes (e.g. spaces), pass a JSON array instead: `tags='["ai","workflow"]'`.
- **Checklist objects vs. strings:** A checklist entry can be a plain string (`"Design"`) or the full object form (`{"step":"Design","done":false}`). Use the object form when you want to pre-set `done`, `result`, or `timestamp` fields.
- **API availability:** Browser and automation code expect the Ticket API at `http://localhost:3001`. Make sure it is running (`bun run api`) before relying on network calls; the CLI works even if the API is down.

**Ticket ID format:**
- Always: `<TYPE>-<YYYY-MM-DD>-<random6>` (e.g., `BUG-2024-06-11-abc123`)

**Ambiguity rules:**
- If a ticket is tagged `focus` and not closed, it is always considered the "active" ticket.
- If no ticket is focused, the most recently updated, not closed ticket is used.
- If all are closed, you get a clear message.

---

## 0. TicketCore.js: The Single Source of Truth

All ticket operations (API, CLI, ticketManager.js) now use the shared `TicketCore.js` library (located at `packages/core/src/TicketCore.js`).

**Responsibilities:**
- Ticket ID generation and validation
- Folder naming and slugification
- Atomic read/write of ticket JSON files
- Metadata validation and normalization
- Filtering, listing, and sorting tickets
- Emoji-prefixed logging for all ticket ops

**Why it matters:**
- Guarantees that all tickets are created, updated, and listed in a consistent, automation-friendly way.
- Ensures every ticket gets its own folder, with all artifacts grouped together.
- Eliminates bugs caused by duplicated or out-of-sync logic between API, CLI, and browser modules.

---

## 1. Overview

The ticketing system is a core, modular subsystem for tracking bugs, features, enhancements, and tasks. It is designed for:

- **Automation:** Integrates with probe-driven Playwright tests and bug-report watcher scripts.
- **Metadata-rich tickets:** All tickets are structured JSON files with essential metadata.
- **Artifact management:** Screenshots, logs, and follow-ups are grouped per ticket.
- **Accessibility:** All ticket actions are available via UI and keyboard shortcuts.
- **Consistency:** All ticket operations (API, CLI, ticketManager.js) use TicketCore for validation, folder structure, and atomic writes.

---

## 2. File Structure & Storage

- **Tickets:** Stored as JSON files in `tests/bug-reports/`, each in its own folder (created by TicketCore).
- **Artifacts:** (screenshots, logs) are saved in the same folder as their ticket, auto-moved by `move-bug-reports.js`.
- **Folder Structure:**
  - Each ticket (bug, feature, enhancement, task) has its own folder:
    ```
    tests/bug-reports/[ISO timestamp]_[ticket ID]_[short title]/
    ```
  - The main ticket JSON file is named:
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

> **Note:** Legacy flat tickets should be migrated to the new folder structure for full compatibility with automation and artifact grouping.

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

## 3c. Troubleshooting: Missing or Broken Ticket Scripts

If the documented ticket scripts (e.g., ticket:latest, ticket:list) are missing or not working:

1. **Manual Fallback:**
   - Open the `tests/bug-reports/` directory in your file explorer or editor.
   - Sort files by date or ID to find the latest ticket (highest date/ID is the newest).
   - Open the ticket JSON file directly to view its details.
   - For focused tickets, search for the `focus` tag in ticket files.

2. **Script Output Issues:**
   - If running `ticketManager.js` directly produces no output, check for errors in the script or missing dependencies.
   - If the API is down, all ticket operations must be done by editing JSON files directly.

3. **Update:**
   - Once scripts are restored, resume using the CLI for all ticket operations.

> **Tip:** Always keep the ticket scripts up to date in `package.json`. If you add or rename scripts, update this guide and `.cursorrules` accordingly.

---

## 4. API, CLI & Module Usage

- **TicketCore.js:** The single source of truth for all ticket operations. Used by API, CLI, and ticketManager.js.
- **ticketManager.js:** Main JS module for ticket creation, updates, and queries (browser and Node). Falls back to TicketCore if API is unavailable.
- **ticket-api.js:** Backend API for ticket CRUD operations. All tickets are created/updated via TicketCore.
- **ticket-cli.js:** CLI tool for all ticket operations. Preferred for automation, scripting, and AI agents. All commands use TicketCore for validation, folder structure, and atomic writes.
- **ID Requirement:** All tickets must include a unique `id`—the backend will reject tickets without it.
- **Artifacts:** Attachments (screenshots, logs) must be referenced in the `artifacts` array and saved in the ticket's folder.
- **Ticket Creation Workflow:**
  - **Preferred:** Always use the CLI (`ticket-cli.js`), ticketManager.js, or the API (all use TicketCore) to create, update, or query tickets. This ensures unique IDs, correct metadata, and proper artifact handling.
  - **Fallback:** If the backend server is not running, you may create a ticket JSON file directly in `tests/bug-reports/` using TicketCore helpers. When the server is available, use the CLI or API to register the ticket and move artifacts if needed. Mark the migration in the ticket's `history` array.
  - **Automation:** Automated scripts and Playwright probes must use the CLI or API when possible. If not, log a warning and save the ticket as a JSON file for later reconciliation.

**Example (CLI):**

```sh
bun run ticket:create type=bug title="Bug report modal does not close after submission" tags=UI,modal,accessibility
```

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

## 7. Ticketing Workflow (Updated)

1. **Check if the Ticket API server is running.**
   - If not, start it: `bun run api`
   - Confirm: "Ticket API running on http://localhost:3001/api/tickets"
2. **Use the API endpoints or ticketManager.js module for all ticket operations.**
   - Create: POST /api/tickets
   - Update: PATCH /api/tickets/:id
   - Get: GET /api/tickets/:id
   - List: GET /api/tickets
   - Check: PATCH /api/tickets/:id (update checklist)
3. **If the API is down and can't be started, manually inspect the JSON files in tests/bug-reports/.**

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

## 8. Probe Workflow & Troubleshooting

### Running Automated Tests

The project includes a unified test runner that handles server startup and Playwright tests:

```sh
bun run test:probes
```

This script:
1. Kills any existing processes on ports 5500 (dev server) and 3001 (ticket API)
2. Starts Five Server on port 5500
3. Starts the ticket API server
4. Runs all Playwright probe tests
5. Performs clean shutdown of all services

### Common Issues & Solutions

**Canvas Not Found**
- **Symptom:** Test fails with "Canvas element not found"
- **Cause:** Dev server not ready or page not loaded
- **Fix:** The test runner now includes proper wait conditions

**window.testRunner Not Ready**
- **Symptom:** Test fails with "Cannot read properties of undefined (testRunner)"
- **Cause:** Test mode not activated or script not loaded
- **Fix:** Press 'T' key or use `page.keyboard.press('t')` in test

**DebugLogger Not Defined**
- **Symptom:** Test fails with "DebugLogger is not defined"
- **Cause:** Missing import or incorrect path
- **Fix:** Import DebugLogger at the top of test file:
  ```js
  import { DebugLogger } from '../js/DebugLogger.js';
  ```

**Port Already in Use**
- **Symptom:** Server fails to start with EADDRINUSE
- **Cause:** Previous instance not properly shut down
- **Fix:** The test runner automatically kills existing processes

### Best Practices

1. **Use the Test Runner**
   - Always use `bun run test:probes` for consistent environment
   - Avoid running individual tests directly

2. **Proper Test Structure**
   ```js
   test.describe('Feature probes', () => {
     test.beforeAll(async () => {
       DebugLogger.log('Starting probe tests');
       // Setup code here
     });

     test('should do something', async ({ page }) => {
       // Test code here
     });
   });
   ```

3. **Error Handling**
   - Use try/catch blocks for expected failures
   - Log errors with DebugLogger for tracing
   - Include screenshots on failure

4. **Clean Up**
   - Tests should clean up their own artifacts
   - Use `test.afterAll()` for cleanup code
   - The test runner handles server shutdown

### Debugging Tips

1. **Enable Verbose Logging**
   ```sh
   DEBUG=pw:* bun run test:probes
   ```

2. **Run Single Test**
   ```sh
   bun run test:probes -- tests/specific-probe.test.js
   ```

3. **View Test Report**
   ```sh
   bunx playwright show-report
   ```

4. **Debug in UI Mode**
   ```sh
   bun run test:probes -- --ui
   ```

### Adding New Probes

1. Create test file in `tests/` directory
2. Import required modules and DebugLogger
3. Use `test.describe()` for grouping
4. Add proper setup/teardown in `beforeAll`/`afterAll`
5. Follow existing probe patterns for consistency

Example:
```js
import { test, expect } from '@playwright/test';
import { DebugLogger } from '../js/DebugLogger.js';

test.describe('New feature probes', () => {
  test.beforeAll(async () => {
    DebugLogger.log('Starting new feature tests');
  });

  test('should validate feature X', async ({ page }) => {
    await page.goto('http://localhost:5500');
    await page.keyboard.press('t'); // Enter test mode
    // Test steps...
  });

  test.afterAll(async () => {
    DebugLogger.log('Completed new feature tests');
  });
});
```

---

## 9. References

- [README.md](../README.md)
- [.cursorrules](./.cursorrules)
- [MCP_TOOLS_GUIDE.md](./MCP_TOOLS_GUIDE.md)
- [MCP_PLAYWRIGHT_TESTING_GUIDE.md](./MCP_PLAYWRIGHT_TESTING_GUIDE.md)

---

_Last updated: 2024-06-01_
