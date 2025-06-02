# MCP Filesystem Server Setup & Security Guide (User-Centric)

> **This guide explains how to configure, secure, and troubleshoot the @modelcontextprotocol/server-filesystem MCP server for your workspace.**

---

## 1. What is the Filesystem MCP Server?
- A Node.js server that lets AI agents (like Cursor, Claude, etc.) read, write, and manage files on your computer.
- Used for advanced automation, code editing, and artifact management in this project.

---

## 2. Where is the Configuration?
- **Global (all projects):**
  - `~/.cursor/mcp.json` (Cursor)
  - `%APPDATA%/Claude/claude_desktop_config.json` (Claude Desktop)
- **Per-project:**
  - `.vscode/mcp.json` (VS Code workspaces)
  - `.cursor/mcp.json` (Cursor projects)

---

## 3. How to Restrict Access (Folders/Files)

### NPX Example (most common):
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "C:/CursorWorkspace/projects/vibe",      // Only this folder is accessible
        "C:/Users/edwar/Documents/other-folder"  // Add more as needed
      ]
    }
  }
}
```
- **Each path in the `args` array** is a root directory the server can access.
- **Only these folders (and their subfolders) are accessible.**

### Docker Example (with read-only and file-level control):
```json
{
  "mcpServers": {
    "filesystem": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "--mount", "type=bind,src=C:/CursorWorkspace/projects/vibe,dst=/projects/vibe",
        "--mount", "type=bind,src=C:/Users/edwar/Documents/secret.txt,dst=/projects/secret.txt,ro",
        "mcp/filesystem",
        "/projects"
      ]
    }
  }
}
```
- **`ro` flag** after a mount makes it read-only.
- **You can mount a single file** for ultra-fine control (Docker only).

### Advanced Restrictions (Optional)
Some hosts (e.g., Claude Desktop) support a `restrictions` block:
```json
"restrictions": {
  "maxFileSizeMB": 10,
  "allowedExtensions": [".txt", ".md", ".csv"]
}
```
- **Not all hosts support this block.**
- For Cursor, folder/file access is controlled by the `args` array.

---

## 4. Security Best Practices
- **Principle of Least Privilege:** Only add folders you want the AI to access.
- **Sensitive files:** Use Docker with `ro` for read-only, or mount only the file.
- **Per-project config:** Use `.vscode/mcp.json` or `.cursor/mcp.json` for project-specific access.
- **Review and audit** your config regularly.

---

## 5. Troubleshooting
- **AI can’t access a file/folder?**
  - Check that the path is included in the `args` array.
  - Use absolute paths (not relative).
- **Permission errors?**
  - Ensure your user account has read/write permissions for the folder/file.
- **Not seeing expected tools?**
  - Restart your AI client (Cursor, Claude, etc.) after changing config.
- **Still stuck?**
  - See the [official README](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md) for advanced options and troubleshooting.

---

## 6. References
- [Official Filesystem MCP Server README](https://github.com/modelcontextprotocol/servers/blob/main/src/filesystem/README.md)
- [Playbooks Guide](https://playbooks.com/mcp/modelcontextprotocol-filesystem)
- [DEV Community Guide](https://dev.to/furudo_erika_7633eee4afa5/how-to-use-local-filesystem-mcp-server-363e)

---

**End of File**
