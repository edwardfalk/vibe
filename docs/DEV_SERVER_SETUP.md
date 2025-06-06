# Development Server Quickstart

This guide summarizes how to run the Vibe development server and automated tests.

## Starting the server

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start Five Server on port 5500:
   ```bash
   npm run serve
   ```
   Alternatively use `npm run dev` to launch Five Server, the ticket API and bug watcher in parallel. The `predev` script will free ports 5500 and 3001 automatically. If port 5500 is already taken Five Server will pick another free port; check the console output for the actual URL.

Five Server is the same Node module used by the popular VS Code extension. You do **not** need to install the extension in this environment—running the above script is enough.

Once started the game is available at:
```
http://localhost:5500
```

## Running tests

After the server is running you can execute probe-driven Playwright tests.

- Run the MCP test suite:
  ```bash
  npm run test:mcp
  ```
- Run all automated tests:
  ```bash
  npm run test:comprehensive
  ```

See `docs/MCP_PLAYWRIGHT_TESTING_GUIDE.md` for more details on the testing workflow.
