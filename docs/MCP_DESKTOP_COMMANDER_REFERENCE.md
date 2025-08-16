# MCP Desktop Commander – Functions Reference

Last updated: 2025-08-16
Scope: Vibe project (Windows, cmd.exe, Bun)

This document catalogs the Desktop Commander MCP server tools available in Cursor for fast filesystem, search, and process control. Use absolute Windows paths (e.g., `D:\projects\vibe\...`). Prefer these tools over slower, native file readers.

## Quick Rules
- Always pass absolute paths (Windows `\\`) for file operations
- Prefer `search_code` for code/text search across the repo
- Chunk file writes into ≤30 lines per call (rewrite → append)
- Long-running processes: use backgrounded REPLs and `list_sessions` + `read_process_output`
- Avoid bashisms; use cmd.exe syntax in examples and project scripts

## Index (by category)
- Configuration: get_config, set_config_value, get_usage_stats
- Filesystem: read_file, read_multiple_files, write_file, create_directory, list_directory, move_file, get_file_info
- Search: search_code, search_files
- Terminal/Processes: start_process, interact_with_process, read_process_output, list_sessions, force_terminate, list_processes, kill_process
- Misc: give_feedback_to_desktop_commander
## Configuration

### get_config
- Purpose: Validate MCP liveness and show server settings
- Params: none (random_string placeholder in some clients)
- Returns: blockedCommands, defaultShell, allowedDirectories, limits, version, client info
- Example: used at session start to confirm health

### set_config_value
- Purpose: Change a config key (e.g., fileReadLineLimit)
- Params: `key`, `value`
- Notes: Use sparingly; prefer repo scripts for durable settings

### get_usage_stats
- Purpose: Tool usage counters for debugging/optimization
- Returns: counts per tool, success rates, session stats
## Filesystem

### read_file
- Purpose: Read file content (or URL with `isUrl: true`)
- Params: `path` (absolute), `offset` (start line), `length` (max lines)
- Notes: Supports images; returns viewable assets; respects allowedDirectories

### read_multiple_files
- Purpose: Batch-read several files
- Params: `paths: string[]`
- Notes: Fails per file independently; faster than serial reads

### write_file
- Purpose: Create/overwrite/append
- Params: `path`, `content`, `mode: rewrite|append`
- Rule: Always chunk into ≤30 lines; rewrite first, then append

### create_directory
- Purpose: Ensure a directory exists (creates nested)
- Params: `path`

### list_directory
- Purpose: List items; marks `[FILE]` vs `[DIR]`
- Params: `path`

### move_file
- Purpose: Move/rename files or directories
- Params: `source`, `destination`

### get_file_info
- Purpose: Metadata (size, times, perms, type). For text: `lineCount`, `appendPosition`
- Params: `path`
## Search

### search_code
- Purpose: Ripgrep-powered recursive code/text search
- Params: `path`, `pattern` (regex), optional: `filePattern`, `ignoreCase`, `maxResults`, `includeHidden`, `contextLines`, `timeoutMs`
- Tips: Use for fast code discovery; returns file paths and matched lines with context

### search_files
- Purpose: Find by name (substring, case-insensitive)
- Params: `path`, `pattern`, optional: `timeoutMs`
- Tips: Good for locating files without reading contents
## Terminal / Process Control

### start_process
- Purpose: Launch REPLs or shell sessions (e.g., `python3 -i`, `node -i`, `bash`, `cmd`)
- Params: `command`, `timeout_ms`, optional `shell`
- Notes: Use for local data analysis (CSV/JSON) or persistent shells

### read_process_output
- Purpose: Retrieve output; detects prompts and waiting states
- Params: `pid`, optional `timeout_ms`

### interact_with_process
- Purpose: Send input to a running process (smart waits)
- Params: `pid`, `input`, optional: `timeout_ms`, `wait_for_prompt`

### list_sessions
- Purpose: List active terminal sessions managed by the tool
- Params: none

### force_terminate
- Purpose: Stop a session created earlier
- Params: `pid`

### list_processes
- Purpose: Inspect OS processes
- Params: none

### kill_process
- Purpose: Kill process by PID
- Params: `pid`
## Code Editing

### edit_block
- Purpose: Surgical, minimal replacements
- Params: `file_path`, `old_string`, `new_string`, optional: `expected_replacements`
- Best practice: Provide just enough context lines for a unique match; prefer multiple small edits

### write_file (rewrite/append)
- Purpose: Full rewrites and appends
- Notes: For long rewrites, split content in 25–30 line chunks
## Best Practices (Vibe)

- Use absolute Windows paths (e.g., `D:\\projects\\vibe\\...`)
- Default to cmd.exe semantics in commands and docs; avoid bashisms
- Prefer `search_code` to discover usage before editing
- For long-running tasks, rely on orchestrated scripts or background sessions and poll via `list_sessions` + `read_process_output`
- After edits, run lint/tests via finite scripts; avoid indefinite foreground commands
- Keep file edits small and targeted; batch using multiple `edit_block` calls

## Quick Examples

- Search for symbol usage:
  - `search_code({ path: "D:\\projects\\vibe", pattern: "playerChanged", filePattern: "*.js", ignoreCase: true, contextLines: 1 })`
- Open a file (first 200 lines):
  - `read_file({ path: "D:\\projects\\vibe\\packages\\systems\\src\\RenderPipeline.js", offset: 0, length: 200 })`
- Replace a string in one file:
  - `edit_block({ file_path: "D:\\projects\\vibe\\packages\\game\\src\\core\\SetupPhases.js", old_string: "RenderPipeline", new_string: "RenderPipeline" })`

## Links

- Official site: desktopcommander.app
- GitHub: wonderwhy-er/DesktopCommanderMCP
- Docs: docs.meshagent.com (tool reference)
