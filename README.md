# Vibe Project

## Bug, Feature, & Enhancement Ticketing System (2024+)

## Ticketing System: Bugs, Enhancements, and Features

The modular ticketing system now supports tracking not only bugs, but also enhancements and new features. All tickets must specify a `type` field with one of the following values:
- `bug`
- `enhancement`
- `feature`

This field is required for all tickets, both via the API and the in-game UI modal. The UI now provides a dropdown to select the ticket type when creating a new ticket.

### Example Ticket JSON
```json
{
  "id": "BR-2024-07-01-001",
  "title": "Player disappears after dashing into wall",
  "type": "bug",
  ...
}
```

Refer to the rest of this README for API usage and workflow details.

### Overview
The ticketing system is a modular, API-driven subsystem supporting:
- Structured JSON tickets (status, history, artifacts, verification, etc.)
- **Supports bugs, features, enhancements, and tasks**
- Ticket types: `bug`, `feature`, `enhancement`, `task`, etc.
- Tags/labels for filtering and organization (e.g., `UI`, `AI`, `QoL`)
- CLI, browser, and automation-friendly management
- In-game, admin, and automated probe/test integration
- Knowledge graph and documentation hooks

### How it Works
- **Tickets** are stored as JSON in `tests/bug-reports/`.
- **API** (`ticket-api.js`) exposes endpoints for creating, updating, listing, and retrieving tickets.
- **Frontend** uses `js/ticketManager.js` to interact with the API from in-game UI, admin tools, or automation scripts.
- **Artifacts** (screenshots, logs) are linked in each ticket.
- **History** tracks all status changes, fix attempts, verification, and comments.
- **Probe/test integration**: Automated tests can create/update tickets and attach results.
- **Knowledge graph**: On ticket resolution, update the Memory Knowledge Graph with new facts/relations.
- **Feature development**: Tickets can be used for new features, enhancements, and AI-driven development, with full progress and design history logged for future reference.

### Ticket Types & Tags
- Each ticket has a `type` field: `bug`, `feature`, `enhancement`, `task`, etc.
- Tickets can have an array of `tags` for filtering and organization (e.g., `["UI", "AI", "QoL"]`).
- Use the modal UI or API to set type and tags when creating or updating tickets.

#### Example Feature Ticket JSON
```json
{
  "id": "abc123",
  "type": "feature",
  "title": "Add co-op multiplayer mode",
  "description": "Allow two players to play together online or locally.",
  "tags": ["multiplayer", "networking", "UI"],
  "status": "Open",
  "history": [],
  "artifacts": [],
  "verification": [],
  "relatedTickets": [],
  "timestamp": "2024-07-01T18:00:00Z"
}
```

### API Endpoints
- `GET    /api/tickets`         List all tickets
- `GET    /api/tickets/:id`     Get a ticket by ID
- `POST   /api/tickets`         Create a new ticket
- `PATCH  /api/tickets/:id`     Update a ticket (partial)

### Bug Report Watcher Script
- The project includes a watcher script: `move-bug-reports.js` (in the project root).
- **Purpose:** Automatically moves bug report files (JSON, markdown, PNG screenshots) from your Downloads folder to the correct subfolder in `tests/bug-reports/`.
- **How it works:**
  - Watches your Downloads folder for files matching the bug report naming convention (timestamp, ID, and title).
  - Moves each file into the appropriate ticket folder, creating the folder if needed.
  - Ensures all bug report artifacts are organized and accessible for both human and AI/agent debugging.
- **How to run:**
  - The watcher runs automatically with `npm run dev` (alongside the dev server).
  - You can also run it alone with `npm run watch-bugs`.
  - To run manually: `node move-bug-reports.js`
- **Note:** The watcher is required for workflows where bug report files are downloaded from the browser (fallback/manual mode). It ensures all artifacts are grouped and accessible in the repo.

### Usage
- Start the API: `node ticket-api.js`
- Use the in-game bug/feature modal or admin UI to create/update tickets
- Use Playwright/MCP scripts for automated bug/feature reporting
- Use tickets for both bugs and features (set the `type` field and add tags as needed)

### Extending
- Add artifact upload endpoints as needed
- Add dashboards, notifications, or analytics
- Integrate with external tools if desired
- **Next step:** Expand UI and workflow to fully support feature requests and enhancements, with progress and design history for both human and AI contributors.

---

## Coding Standards & Architecture
- See the top of this README and `.cursorrules` for the latest standards and architecture rules.
- The ticketing system is now a core part of the Vibe project and should be kept up to date with all future improvements.
