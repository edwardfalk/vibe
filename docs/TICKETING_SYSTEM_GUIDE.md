# Ticketing System Guide

This guide provides a comprehensive overview of the Vibe ticketing system. All ticket operations are handled via a REST API.

---

## API Quick Reference

The API runs at `http://localhost:3001`. All requests and responses are JSON.

> ℹ️  The port can be overridden by setting the `TICKET_API_PORT` environment variable before starting the server (see `ticket-api.js`).

### Available Query Parameters

| Param   | Description | Example |
|---------|-------------|---------|
| `type`  | Filter by ticket type (`bug`, `feature`, `enhancement`, `task`) | `/api/tickets?type=bug` |
| `status`| Filter by status (`open`, `in-progress`, `closed`, etc.) | `/api/tickets?status=open` |
| `focus` | If `true`, return only "focus" tickets (high priority) | `/api/tickets?focus=true` |
| `limit` | Max results (default 100) | `/api/tickets?limit=20` |
| `offset`| Pagination offset | `/api/tickets?limit=20&offset=20` |

---

### Health Check

HEAD `http://localhost:3001/api/health` → `200 OK` if the server is alive.

**List Tickets:**
```sh
curl "http://localhost:3001/api/tickets"
# With query:
curl "http://localhost:3001/api/tickets?type=bug&status=open"
```

**Create a Ticket:**
```sh
curl -X POST -H "Content-Type: application/json" \
  -d '{"id": "TASK-123", "type": "task", "title": "My New Task"}' \
  "http://localhost:3001/api/tickets"
```

**Get a Ticket:**
```sh
curl "http://localhost:3001/api/tickets/TASK-123"
```

**Update a Ticket:**
```sh
curl -X PATCH -H "Content-Type: application/json" \
  -d '{"status": "in-progress"}' \
  "http://localhost:3001/api/tickets/TASK-123"
```

**Delete a Ticket:**
```sh
curl -X DELETE "http://localhost:3001/api/tickets/TASK-123"
```
---

## Core Concepts

The ticketing system is designed for:
- **Automation:** Integrates with Playwright tests.
- **Metadata-rich tickets:** All tickets are structured JSON files.
- **Centralized Logic:** The `ticket-api.js` server is the single entry point and delegates to **`packages/api/src/TicketRouter.js`** → **`TicketService.js`** → **`TicketCore.js`** for all logic and persistence.

---

## Ticket Format (JSON Schema)

A ticket must include:
- `id` (string, unique)
- `type` (string: `bug`, `feature`, `enhancement`, `task`)
- `title` (string)
- `status` (string: `open`, `in-progress`, `closed`, etc.)
- Other optional fields: `description`, `tags`, `checklist`, `history`, `artifacts`, `relatedTickets`.

---

## Troubleshooting

1.  **Check the API server:** Ensure the dev server (`bun run dev`) is running. You should see logs for the API service.
2.  **Check port `3001`:** Make sure no other process is blocking the API port.
3.  **Check JSON format:** When using `curl`, ensure your JSON payloads are correctly formatted and quoted for your shell.

The API provides specific error messages for invalid requests, typically with a `400 Bad Request` status.

---
## Deprecated Interfaces

The old `bun run ticket:*` CLI scripts are **deprecated** and have been removed. Always use the REST API.
