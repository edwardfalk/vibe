# MCP_TOOLS_GUIDE.md

> **Purpose:**  
> This guide details all MCP tools for memory, testing, and file operations in Vibe.  
> For rules, see [.cursorrules](../.cursorrules).

---

## 🔗 Official Documentation & Resources

- [MCP Tools Concept](https://modelcontextprotocol.io/docs/concepts/tools) — Official, up-to-date tool structure, best practices, and security notes.
- [MCP Introduction](https://modelcontextprotocol.io/introduction) — Protocol overview and architecture.
- [rawr-ai/mcp-filesystem GitHub](https://github.com/rawr-ai/mcp-filesystem) — Filesystem server implementation and options.

---

> **Tip:** MCP supports dynamic tool discovery via the `tools/list` endpoint. The AI or user can always check for new or updated tools if the server is upgraded or reconfigured. See [Tool Discovery and Updates](https://modelcontextprotocol.io/docs/concepts/tools#tool-discovery-and-updates).

> **Note:** Each MCP tool can include annotations (metadata) to describe its behavior (e.g., `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`). These hints help the AI and users understand tool side effects and safety, but should not be relied on for security decisions. See [Tool Annotations](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations) for details.

---

## 1. Introduction & Purpose

The Model Context Protocol (MCP) is a universal, open standard for connecting AI models and agents to external tools, data sources, and workflows. MCP tools are the backbone of Vibe's advanced automation, memory, and testing systems. This guide explains how to use MCP tools effectively, securely, and in line with modern best practices.

**Who is this for?**

- Developers, testers, and AI agents working on Vibe
- Anyone integrating, debugging, or extending MCP-powered workflows

**What's covered:**

- Tool categories and when to use them
- Practical usage examples
- Best practices and troubleshooting
- Advanced workflows and references

---

## 2. MCP Tool Categories (Overview)

1. Memory Management Tools
2. Playwright Testing Tools
3. Filesystem Operations Tools
4. GitHub Integration Tools
5. Web Search & Knowledge Tools
6. Miscellaneous/Advanced Tools

---

## 3. MCP Tools Reference (Full List)

### 3.1 Memory Management Tools

#### `mcp_memory_read_graph`

- **Category:** Memory Management
- **Description:** Reads the entire knowledge graph (entities, relations, observations).
- **When to Use:** To get a full snapshot of project memory, especially when searching yields no results or for audits.
- **How to Use:**
  ```js
  mcp_memory_read_graph({ random_string: 'any' });
  ```
- **Best Practices:** Use sparingly—can be large. Prefer targeted searches first.

#### `mcp_memory_search_nodes`

- **Category:** Memory Management
- **Description:** Searches for nodes (entities, relations, observations) in the knowledge graph by query.
- **When to Use:** To find if an entity or observation already exists before creating new ones.
- **How to Use:**
  ```js
  mcp_memory_search_nodes({ query: 'Player' });
  ```
- **Best Practices:** Always search before adding to avoid duplicates.

#### `mcp_memory_open_nodes`

- **Category:** Memory Management
- **Description:** Retrieves full details for specific entities by name.
- **When to Use:** To inspect or update a specific entity's observations or relations.
- **How to Use:**
  ```js
  mcp_memory_open_nodes({ names: ['Player'] });
  ```
- **Best Practices:** Use after search to drill down.

#### `mcp_memory_knowledge_graph_create_entities`

- **Category:** Memory Management
- **Description:** Creates new entities in the knowledge graph.
- **When to Use:** When introducing a new concept/component to project memory.
- **How to Use:**
  ```js
  mcp_memory_knowledge_graph_create_entities({
    entities: [
      { name: 'NewSystem', entityType: 'System', observations: ['Handles X'] },
    ],
  });
  ```
- **Best Practices:** Keep names meaningful and responsibilities clear.

#### `mcp_memory_knowledge_graph_create_relations`

- **Category:** Memory Management
- **Description:** Creates directed relations between entities.
- **When to Use:** To document dependencies or interactions (e.g., Player _fires_ Bullet).
- **How to Use:**
  ```js
  mcp_memory_knowledge_graph_create_relations({
    relations: [{ from: 'Player', to: 'Bullet', relationType: 'fires' }],
  });
  ```
- **Best Practices:** Use active voice for relation types.

#### `mcp_memory_knowledge_graph_add_observations`

- **Category:** Memory Management
- **Description:** Adds new observations (facts/notes) to existing entities.
- **When to Use:** To update an entity with new information or state.
- **How to Use:**
  ```js
  mcp_memory_knowledge_graph_add_observations({
    observations: [
      { entityName: 'Player', contents: ['Now supports double-jump.'] },
    ],
  });
  ```
- **Best Practices:** Keep observations concise and factual.

#### `mcp_memory_knowledge_graph_delete_entities`

- **Category:** Memory Management
- **Description:** Deletes entities and their relations from the graph.
- **When to Use:** To remove deprecated or merged concepts.
- **How to Use:**
  ```js
  mcp_memory_knowledge_graph_delete_entities({ entityNames: ['OldSystem'] });
  ```
- **Best Practices:** Archive before deleting if unsure.

#### `mcp_memory_knowledge_graph_delete_observations`

- **Category:** Memory Management
- **Description:** Removes specific observations from entities.
- **When to Use:** To clean up outdated or incorrect notes.
- **How to Use:**
  ```js
  mcp_memory_knowledge_graph_delete_observations({
    deletions: [{ entityName: 'Player', observations: ['Old fact.'] }],
  });
  ```
- **Best Practices:** Regularly prune for clarity.

#### `mcp_memory_knowledge_graph_delete_relations`

- **Category:** Memory Management
- **Description:** Deletes specific relations between entities.
- **When to Use:** To update or correct the project's dependency map.
- **How to Use:**
  ```js
  mcp_memory_knowledge_graph_delete_relations({
    relations: [{ from: 'Player', to: 'Bullet', relationType: 'fires' }],
  });
  ```
- **Best Practices:** Keep the graph current and accurate.

---

### 3.2 Playwright Testing Tools

#### `mcp_playwright_navigate`

- **Category:** Playwright Testing
- **Description:** Navigates the browser to a specified URL.
- **When to Use:** To start a test session or reset state.
- **How to Use:**
  ```js
  mcp_playwright_navigate({ url: 'http://localhost:5500' });
  ```
- **Best Practices:** Always start tests from a known state.

#### `mcp_playwright_playwright_click`

- **Category:** Playwright Testing
- **Description:** Clicks an element on the page by CSS selector.
- **When to Use:** To simulate user interaction (e.g., button press).
- **How to Use:**
  ```js
  mcp_playwright_playwright_click({ selector: '#start-button' });
  ```
- **Best Practices:** Use stable selectors; fallback to coordinates if needed.

#### `mcp_playwright_playwright_fill`

- **Category:** Playwright Testing
- **Description:** Fills an input field with a value.
- **When to Use:** To simulate typing or form entry.
- **How to Use:**
  ```js
  mcp_playwright_playwright_fill({ selector: '#username', value: 'testuser' });
  ```
- **Best Practices:** Clear field before filling if test is flaky.

#### `mcp_playwright_playwright_select`

- **Category:** Playwright Testing
- **Description:** Selects a value in a dropdown/select element.
- **When to Use:** To automate form selection.
- **How to Use:**
  ```js
  mcp_playwright_playwright_select({ selector: '#difficulty', value: 'hard' });
  ```
- **Best Practices:** Validate options before selecting.

#### `mcp_playwright_playwright_hover`

- **Category:** Playwright Testing
- **Description:** Hovers over an element by selector.
- **When to Use:** To trigger tooltips or hover states.
- **How to Use:**
  ```js
  mcp_playwright_playwright_hover({ selector: '.enemy-icon' });
  ```
- **Best Practices:** Use for UI state checks.

#### `mcp_playwright_playwright_press_key`

- **Category:** Playwright Testing
- **Description:** Simulates a keyboard key press (optionally focused on a selector).
- **When to Use:** To trigger keyboard shortcuts or game controls.
- **How to Use:**
  ```js
  mcp_playwright_playwright_press_key({ key: 'T' });
  ```
- **Best Practices:** Use for activating test mode or shortcuts.

#### `mcp_playwright_playwright_screenshot`

- **Category:** Playwright Testing
- **Description:** Captures a screenshot of the page or element.
- **When to Use:** For bug reports, visual regression, or artifact capture.
- **How to Use:**
  ```js
  mcp_playwright_playwright_screenshot({ name: 'game-over', fullPage: true });
  ```
- **Best Practices:** Name screenshots clearly; save to bug-report folder.

#### `mcp_playwright_playwright_get_visible_text`

- **Category:** Playwright Testing
- **Description:** Retrieves all visible text from the current page.
- **When to Use:** For assertions or content checks.
- **How to Use:**
  ```js
  mcp_playwright_playwright_get_visible_text({ random_string: 'any' });
  ```
- **Best Practices:** Use for accessibility and content tests.

#### `mcp_playwright_playwright_get_visible_html`

- **Category:** Playwright Testing
- **Description:** Gets the HTML content of the current page.
- **When to Use:** For DOM structure checks or debugging.
- **How to Use:**
  ```js
  mcp_playwright_playwright_get_visible_html({ random_string: 'any' });
  ```
- **Best Practices:** Use for snapshot or diff-based tests.

#### `mcp_playwright_playwright_console_logs`

- **Category:** Playwright Testing
- **Description:** Retrieves browser console logs (filterable by type).
- **When to Use:** For debugging, bug reports, or artifact capture.
- **How to Use:**
  ```js
  mcp_playwright_playwright_console_logs({ type: 'error', limit: 50 });
  ```
- **Best Practices:** Always capture logs on test failure.

#### `mcp_playwright_playwright_close`

- **Category:** Playwright Testing
- **Description:** Closes the browser and releases resources.
- **When to Use:** To end a test session or free up resources.
- **How to Use:**
  ```js
  mcp_playwright_playwright_close({ random_string: 'any' });
  ```
- **Best Practices:** Always close sessions after tests.

---

### 3.3 Filesystem Operations Tools

#### `mcp_filesystem_read_file`

- **Category:** Filesystem Operations
- **Description:** Reads the contents of a file (supports text and some binary).
- **When to Use:** To inspect, audit, or process file contents.
- **How to Use:**
  ```js
  mcp_filesystem_read_file({
    path: 'D:/projects/vibe/README.md',
  });
  ```
- **Best Practices:** Use absolute paths; check file size for large files.

#### `mcp_filesystem_read_multiple_files`

- **Category:** Filesystem Operations
- **Description:** Reads multiple files in one call (efficient for batch operations).
- **When to Use:** For audits, comparisons, or batch processing.
- **How to Use:**
  ```js
  mcp_filesystem_read_multiple_files({
    paths: ['C:/.../file1.js', 'C:/.../file2.js'],
  });
  ```
- **Best Practices:** Limit batch size to avoid overload.

#### `mcp_filesystem_edit_file`

- **Category:** Filesystem Operations
- **Description:** Makes line-based edits to a file (diff-style, safe for automation).
- **When to Use:** For precise, scriptable code changes.
- **How to Use:**
  ```js
  mcp_filesystem_edit_file({
    path: 'C:/.../file.js',
    edits: [{ oldText: 'foo', newText: 'bar' }],
  });
  ```
- **Best Practices:** Always preview diffs before applying in bulk.

#### `mcp_filesystem_write_file`

- **Category:** Filesystem Operations
- **Description:** Overwrites or creates a file with new content.
- **When to Use:** For file generation, resets, or automation.
- **How to Use:**
  ```js
  mcp_filesystem_write_file({ path: 'C:/.../newfile.txt', content: 'Hello!' });
  ```
- **Best Practices:** Use with caution—overwrites existing files.

#### `mcp_filesystem_create_directory`

- **Category:** Filesystem Operations
- **Description:** Creates a new directory (including nested paths).
- **When to Use:** For setup, scaffolding, or organizing artifacts.
- **How to Use:**
  ```js
  mcp_filesystem_create_directory({ path: 'C:/.../newdir' });
  ```
- **Best Practices:** Idempotent—safe to call if dir exists.

#### `mcp_filesystem_list_directory`

- **Category:** Filesystem Operations
- **Description:** Lists all files and directories at a path.
- **When to Use:** For navigation, audits, or scripting.
- **How to Use:**
  ```js
  mcp_filesystem_list_directory({ path: 'C:/.../' });
  ```
- **Best Practices:** Use before file operations to confirm paths.

#### `mcp_filesystem_directory_tree`

- **Category:** Filesystem Operations
- **Description:** Recursively lists all files and directories as a tree (JSON structure).
- **When to Use:** For visualizing or scripting over directory structures.
- **How to Use:**
  ```js
  mcp_filesystem_directory_tree({ path: 'C:/.../' });
  ```
- **Best Practices:** Useful for audits and migration scripts.

#### `mcp_filesystem_search_files`

- **Category:** Filesystem Operations
- **Description:** Recursively searches for files/directories matching a pattern.
- **When to Use:** To find files by name or partial match.
- **How to Use:**
  ```js
  mcp_filesystem_search_files({ path: 'C:/.../', pattern: '*.js' });
  ```
- **Best Practices:** Use exclude patterns to filter noise.

#### `mcp_filesystem_get_file_info`

- **Category:** Filesystem Operations
- **Description:** Gets metadata (size, timestamps, permissions) for a file or directory.
- **When to Use:** For audits, debugging, or migration.
- **How to Use:**
  ```js
  mcp_filesystem_get_file_info({ path: 'C:/.../file.js' });
  ```
- **Best Practices:** Use before destructive operations.

#### `mcp_filesystem_move_file`

- **Category:** Filesystem Operations
- **Description:** Moves or renames files/directories.
- **When to Use:** For refactoring, organizing, or renaming.
- **How to Use:**
  ```js
  mcp_filesystem_move_file({
    source: 'C:/.../old.js',
    destination: 'C:/.../new.js',
  });
  ```
- **Best Practices:** Ensure destination does not exist.

#### `mcp_filesystem_delete_file`

- **Category:** Filesystem Operations
- **Description:** Deletes a file (fails gracefully if not found).
- **When to Use:** For cleanup, automation, or artifact management.
- **How to Use:**
  ```js
  mcp_filesystem_delete_file({ target_file: 'C:/.../file.js' });
  ```
- **Best Practices:** Confirm with list/info before deleting.

---

### 3.4 CodeRabbit Game Debugging Tools (NEW)

#### `bun run debug:game` (CodeRabbit Game Debugger)

- **Category:** Game Debugging
- **Description:** Comprehensive AI-powered analysis of all game files for bugs, performance issues, and code quality problems.
- **When to Use:** For thorough debugging sessions, before releases, or when investigating game stability issues.
- **How to Use:**
  ```bash
  bun run debug:game
  ```
- **Output:** Generates `VIBE_GAME_DEBUGGING_REPORT.md` with detailed findings
- **Best Practices:** Run after major changes; review all critical bugs first.

#### `bun run debug:probe` (Game Debugging Probe)

- **Category:** Game Debugging
- **Description:** Quick health check that provides game health score (0-100) and summary of critical issues.
- **When to Use:** For daily health checks, progress tracking, or quick issue assessment.
- **How to Use:**
  ```bash
  bun run debug:probe
  ```
- **Output:** Console summary with health score and issue counts
- **Best Practices:** Run regularly to track improvement; use before and after fixes.

#### CodeRabbit Game Debugger Features

- **Critical Bug Detection:** Identifies issues that could crash the game (null pointer exceptions, p5.js instance mode violations)
- **Performance Analysis:** Finds frame rate bottlenecks, memory leaks, and expensive operations
- **Memory Leak Detection:** Discovers timer leaks, object creation in game loops, and cleanup issues
- **Cross-File Correlation:** Identifies systemic issues affecting multiple files
- **Game Health Scoring:** Provides 0-100 score based on code quality and stability
- **Actionable Recommendations:** Generates specific fix instructions with code examples

#### Common Issues Detected

1. **p5.js Instance Mode Violations** - Using global p5 functions instead of `this.p.method()`
2. **Missing Null Checks** - Accessing object properties without safety validation
3. **Memory Leaks** - Timers without cleanup, object creation in game loops
4. **Frame-Rate Dependencies** - Movement not using deltaTimeMs for frame-independent timing
5. **Console Logging in Production** - Performance-affecting logs in game loop
6. **Systemic Code Quality Issues** - Inconsistent patterns across multiple files

#### Integration with Existing Systems

- **Ticketing System:** Can create bug tickets from debugging findings
- **MCP Playwright:** Automated testing of fixes and regression detection
- **Memory Management:** Updates knowledge graph with debugging insights
- **Probe Architecture:** Consistent JSON output for automation

---

### 3.5 GitHub Integration Tools

#### `mcp_github_create_or_update_file`

- **Category:** GitHub Integration
- **Description:** Creates or updates a file in a GitHub repo (commit message required).
- **When to Use:** For automation, CI/CD, or remote edits.
- **How to Use:**
  ```js
  mcp_github_create_or_update_file({
    owner: 'user',
    repo: 'vibe',
    path: 'README.md',
    content: '...',
    message: 'Update readme',
    branch: 'main',
  });
  ```
- **Best Practices:** Use correct branch and SHA for updates.

#### `mcp_github_search_repositories`

- **Category:** GitHub Integration
- **Description:** Searches for repositories by query.
- **When to Use:** For discovery, automation, or integration.
- **How to Use:**
  ```js
  mcp_github_search_repositories({ query: 'vibe' });
  ```
- **Best Practices:** Use filters for precision.

#### `mcp_github_create_repository`

- **Category:** GitHub Integration
- **Description:** Creates a new repository in your account.
- **When to Use:** For project setup or automation.
- **How to Use:**
  ```js
  mcp_github_create_repository({ name: 'new-repo', private: true });
  ```
- **Best Practices:** Set visibility and initialize with README if needed.

#### `mcp_github_get_file_contents`

- **Category:** GitHub Integration
- **Description:** Gets the contents of a file or directory from a repo.
- **When to Use:** For audits, automation, or migration.
- **How to Use:**
  ```js
  mcp_github_get_file_contents({
    owner: 'user',
    repo: 'vibe',
    path: 'README.md',
  });
  ```
- **Best Practices:** Specify branch if not default.

#### `mcp_github_push_files`

- **Category:** GitHub Integration
- **Description:** Pushes multiple files in a single commit.
- **When to Use:** For batch updates or automation.
- **How to Use:**
  ```js
  mcp_github_push_files({
    owner: 'user',
    repo: 'vibe',
    branch: 'main',
    files: [{ path: 'a.js', content: '...' }],
    message: 'Batch update',
  });
  ```
- **Best Practices:** Use for atomic, multi-file changes.

#### `mcp_github_create_issue`

- **Category:** GitHub Integration
- **Description:** Creates a new issue in a repo.
- **When to Use:** For bug tracking, automation, or reporting.
- **How to Use:**
  ```js
  mcp_github_create_issue({ owner: 'user', repo: 'vibe', title: 'Bug found' });
  ```
- **Best Practices:** Add labels and assignees for triage.

#### `mcp_github_create_pull_request`

- **Category:** GitHub Integration
- **Description:** Creates a new pull request.
- **When to Use:** For code review, automation, or CI/CD.
- **How to Use:**
  ```js
  mcp_github_create_pull_request({
    owner: 'user',
    repo: 'vibe',
    title: 'Feature PR',
    head: 'feature-branch',
    base: 'main',
  });
  ```
- **Best Practices:** Use draft PRs for work-in-progress.

---

### 3.6 Web Search & Knowledge Tools

#### `mcp_tavily_tavily-search`

- **Category:** Web Search/Knowledge
- **Description:** Performs advanced, real-time web search using Tavily's AI engine.
- **When to Use:** For up-to-date research, fact-checking, or knowledge gathering.
- **How to Use:**
  ```js
  mcp_tavily_tavily -
    search({
      query: 'MCP tools best practices 2024',
      search_depth: 'advanced',
    });
  ```
- **Best Practices:** Use filters and max_results for focused results.

#### `web_search`

- **Category:** Web Search/Knowledge
- **Description:** Performs a general web search (basic, less advanced than Tavily).
- **When to Use:** For quick lookups or broad queries.
- **How to Use:**
  ```js
  web_search({ search_term: 'Vibe project architecture' });
  ```
- **Best Practices:** Use Tavily for deeper research.

---

### 3.7 Miscellaneous/Advanced Tools

#### `mcp_sequentialThinking_sequentialthinking`

- **Category:** Advanced/Miscellaneous
- **Description:** Supports stepwise, chain-of-thought reasoning and planning.
- **When to Use:** For complex, multi-step problem solving or analysis.
- **How to Use:**
  ```js
  mcp_sequentialThinking_sequentialthinking({
    thought: 'Break down the problem',
    nextThoughtNeeded: true,
    thoughtNumber: 1,
    totalThoughts: 3,
  });
  ```
- **Best Practices:** Use for planning, debugging, or AI-driven workflows.

#### `mcp_image_fetch_images`

- **Category:** Advanced/Miscellaneous
- **Description:** Fetches and processes images from URLs or local paths.
- **When to Use:** For artifact capture, bug reports, or visual analysis.
- **How to Use:**
  ```js
  mcp_image_fetch_images({ image_sources: ['https://example.com/image.png'] });
  ```
- **Best Practices:** Use for screenshots, logs, or visual regression.

---

## 3.7 Filesystem MCP Server (AI Usage Notes)

<!--
### 🛠️ Dynamic Tool Discovery

- MCP supports dynamic tool discovery via the `tools/list` endpoint. The AI or user can always check for new or updated tools if the server is upgraded or reconfigured.
- For more, see [MCP Tools Concept](https://modelcontextprotocol.io/docs/concepts/tools#tool-discovery-and-updates).

### 🏷️ Tool Annotations & Metadata

- Each MCP tool can include annotations (metadata) to describe its behavior:
    - `readOnlyHint`: True if the tool does not modify its environment
    - `destructiveHint`: True if the tool may perform destructive updates
    - `idempotentHint`: True if repeated calls with the same arguments have no additional effect
    - `openWorldHint`: True if the tool interacts with external systems (like the web)
- These hints help the AI and users understand tool side effects and safety, but should not be relied on for security decisions.
- See [Tool Annotations](https://modelcontextprotocol.io/docs/concepts/tools#tool-annotations) for details.
-->

- This project uses **@modelcontextprotocol/server-filesystem** for all MCP file operations.
- **Access is restricted**: Only folders listed in the MCP config (`args` array) are accessible to the AI.
- **No separate settings file**: All access control is set in the main MCP config (e.g., `.vscode/mcp.json`, `.cursor/mcp.json`, or global config).
- **For advanced config, security, or per-file/folder restrictions:** See the [official README](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md).
- **AI best practice:** Always use absolute paths and operate only within allowed directories. If unsure, use the `list_allowed_directories` tool to check accessible roots.

---

## 📦 Filesystem Tools: Path Handling & Best Practices

### Path Handling Table

| Tool Type / Command                     | Path Type Required | Error on Wrong Path | Notes/Best Practice                        |
| --------------------------------------- | :----------------: | :------------------ | ------------------------------------------ |
| Built-in (edit_file, read_file, etc.)   |      Relative      | "path should be..." | Use for day-to-day dev; workspace-relative |
| MCP Filesystem (all)                    |      Absolute      | "Access denied"     | Use for automation, batch, advanced ops    |
| mcp_filesystem_list_allowed_directories |        N/A         | N/A                 | Use to discover valid root paths           |

- **Built-in tools** (edit_file, read_file, list_dir, delete_file):

  - Only accept **relative paths** (e.g., `file-command-tests/native-test/test.txt`)
  - Will fail with a "path should be..." error if given an absolute path

- **MCP Filesystem tools** (write, read, edit, move, etc.):
  - Only accept **absolute paths** (e.g., `D:/projects/vibe/file-command-tests/native-test/test.txt`)
  - Will fail with "Access denied" if given a relative path or a path outside allowed directories

---

### Discovering Allowed Directories

Before using MCP filesystem tools, always check which absolute paths are permitted:

```js
mcp_filesystem_list_allowed_directories({});
// Returns: [ "D:/projects", ... ]
```

**Best Practice:**

- Only operate within these directories.
- All absolute paths must start with one of the allowed roots.

---

### Error Handling & Troubleshooting

| Error Message                                | Likely Cause                                  | Solution                              |
| -------------------------------------------- | --------------------------------------------- | ------------------------------------- |
| "Access denied"                              | Path is not absolute, or outside allowed dirs | Use absolute path within allowed dirs |
| "path should be a `path.relative()`d string" | Built-in tool given absolute path             | Use relative path for built-in tools  |
| "Could not find file ..."                    | Typo or wrong path type                       | Double-check path and type            |

---

### Symlink and Permission Flags

- The MCP server enforces strict path validation and permission flags.
- By default, symlinks are followed only if both the link and target are within allowed directories.
- Permission flags (`--readonly`, `--full-access`, `--allow-create`, etc.) control what operations are available.  
  See [rawr-ai/mcp-filesystem GitHub](https://github.com/rawr-ai/mcp-filesystem) for details.

---

### Reference

- [rawr-ai/mcp-filesystem GitHub](https://github.com/rawr-ai/mcp-filesystem) (official server documentation)

---

## 🗂️ XML Tools (For Future Use)

The MCP filesystem server also provides tools for working with XML files.  
**These are not currently used in this project, but are available for future automation or data processing needs.**

### Available XML Tools

- **xml_to_json**

  - Convert an XML file to a JSON file.
  - Inputs: `xmlPath` (source XML), `jsonPath` (destination JSON), options (see below).
  - Options: `ignoreAttributes`, `preserveOrder`, `format`, `indentSize`.
  - Requires read permission for XML and create/edit for JSON.

- **xml_to_json_string**

  - Convert an XML file to a JSON string (returned directly).
  - Inputs: `xmlPath`, options.
  - Returns: JSON string.

- **xml_query**

  - Query an XML file using XPath expressions.
  - Inputs: `path` (XML file), `query` (XPath), options.
  - Returns: JSON representation of query results or structure.

- **xml_structure**
  - Analyze XML structure without reading the entire file.
  - Inputs: `path` (XML file), options.
  - Returns: Statistical info about elements, attributes, and structure.

**Example Usage:**

```js
mcp_filesystem_xml_to_json({
  xmlPath: 'D:/projects/vibe/data/sample.xml',
  jsonPath: 'D:/projects/vibe/data/sample.json',
  options: { format: true, indentSize: 2 },
});
```

**See the [rawr-ai/mcp-filesystem repo](https://github.com/rawr-ai/mcp-filesystem) for full details and option descriptions.**

---

## Summary

- **Always use the correct path type for each tool.**
- **Check allowed directories before using MCP filesystem tools.**
- **Refer to this guide and the official repo for troubleshooting and advanced usage.**
- **XML tools are available for future needs.**

---

## 4. Best Practices & Troubleshooting

### AI File Edit Safety Workflow

1. **Always use `dryRun` for MCP edits and review the diff.**
2. **Backup the file before any real edit.**
3. **Apply the edit.**
4. **Immediately read and validate the file's content and structure.**
5. **If the file is corrupted or missing expected content, restore from backup.**
6. **Optionally, run a linter/validator for code or config files.**
7. **Delete the backup if the edit is successful.**

This workflow prevents accidental data loss and ensures robust, safe AI-driven editing.

- Prefer targeted, minimal operations—avoid full-graph or batch calls unless needed.
- Always check path requirements (absolute for MCP, relative for built-in tools).
- Use Playwright probe-driven tests for all automation.
- Regularly prune memory and keep the knowledge graph current.
- Capture artifacts (screenshots, logs) for all bug reports.
- Reference this guide and the main `.cursorrules` for standards.

---

## 5. References & Further Reading

- `.cursorrules` (core standards)
- `README.md` (architecture, file structure)
- `MCP_PLAYWRIGHT_TESTING_GUIDE.md` (advanced Playwright workflows)
- Official MCP documentation (for protocol details)

---

**End of File**
