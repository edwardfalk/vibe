# AI Chat Terminal Command Behavior (notes)

Purpose: Track which command patterns reliably complete in the chat terminal versus those that stall, so we can standardize usage and enforcement.

Environment under test

- OS: Windows 11 (cmd.exe default)
- Terminal profiles: cmd.exe with UTF-8; optional no‑Clink profile
- Clink: v1.7.22.38f1a3 (AutoRun injected)
- Code page: 65001
- Project: `D:\projects\vibe`

Legend

- Works: reliably returns control to chat in seconds
- Unreliable: sometimes returns, sometimes stalls the chat UI
- Hangs: consistently stalls the chat UI until manually skipped/killed

Findings

1. Streaming to chat (no redirection)

- `bun run lint` → Hangs (chat stalls on large output)
- `cmd /C "bun run lint"` → Unreliable (still streams large output; can stall)
- `cmd /D /C "bun run lint"` (bypass AutoRun/Clink) → Unreliable (same as above)
- Opening an interactive shell (e.g., “Open in Terminal”, or `cmd` / `cmd /K`) → Hangs (leaves prompt open)

Clink disabled (fresh terminals)

- `bun run lint` → Worked once (foreground stream)
- `cmd /C "bun run lint"` → Hangs (foreground stream)
- `cmd /C "cd /d D:\\projects\\vibe && if exist logs\\*.txt del /q logs\\*.txt 2> NUL && if exist logs\\*.exit del /q logs\\*.exit 2> NUL && ver"` → Hangs (prep one-liner)

Additional negative examples observed

- `cmd /C "cd /d D:\\projects\\vibe && if not exist logs mkdir logs && del /q logs\\lint.txt logs\\lint.exit 2> NUL && cmd /V:ON /C \"bun run lint > logs\\\\lint.txt 2>&1 & echo EXITCODE=!ERRORLEVEL! > logs\\\\lint.exit\""` → Failed/hangs; nested `cmd` with heavy escaping broke quoting and produced "Det går inte att hitta sökvägen."; avoid nested `cmd`.
- `cmd /C "cd /d D:\\projects\\vibe && if not exist logs mkdir logs & bun run lint > logs\\lint_simple.txt 2>&1 & echo EXITCODE=%ERRORLEVEL%>logs\\lint_simple.exit"` → Hangs.
- `cmd /C "bun run ai:lint"` → Hangs (even with wrapper; treat as unreliable in chat UI).

2. Redirecting output to file (no streaming)

- `cmd /C "bun run lint > logs\\lint.txt 2>&1"` → Unreliable in chat (sometimes stalls despite redirection)
- `cmd /V:ON /C "bun run lint > logs\\lint.txt 2>&1 & echo EXITCODE=!ERRORLEVEL! > logs\\lint.exit"` → Unreliable in chat
- `cmd /C "bun run lint > logs\\lint.txt 2>&1 & type logs\\lint.txt > NUL"` → Unreliable in chat
- Optional tail preview (when needed): `powershell -NoProfile -Command "Get-Content logs\\lint.txt -Tail 200"` → Works, but only after a reliable producer created the log.

3. Deterministic pattern (Works)

- Run the command in the background (non-interactive) and write logs/exit markers. Then poll the files from chat:
  - Background: `is_background: true` with command `cmd /C "bun run lint > logs\\lint.txt 2>&1 & echo EXITCODE=%ERRORLEVEL% > logs\\lint.exit"`
  - Polling: read `logs/lint.exit` until present, then read `logs/lint.txt` (tail 200 lines) to summarize.
  - Rationale: avoids chat UI stream capture and interactive shells entirely.

4. Clink influence

- Using the no‑Clink profile (cmd.exe with `/d` and no AutoRun) does not change behavior for large streamed outputs.
- Conclusion: Clink is not the root cause; chat UI stalls on large inline output.

Summary rule (for AI‑run commands in chat)

- Always redirect stdout/stderr to a file and avoid streaming long outputs into chat.
- Prefer adding an exit marker file when the exit code matters for follow‑up logic.

Canonical patterns

- Quiet + log: `cmd /C "<command> > logs\\run.txt 2>&1"`
- Log + exit marker: `cmd /V:ON /C "<command> > logs\\run.txt 2>&1 & echo EXITCODE=!ERRORLEVEL! > logs\\run.exit"`
- Optional tail view: `powershell -NoProfile -Command "Get-Content logs\\run.txt -Tail 200"`

Enforcement ideas

- Package scripts: add `ai:*` wrappers that always redirect (e.g., `ai:lint`, `ai:test`, `ai:scan`).
- Scanners (already enabled):
  - forbid interactive shells in scripts/docs: `cmd /K`, bare `cmd.exe` without `/C`.
- Rule updates: require assistants to prefer `ai:*` wrappers in chat; allow raw commands only with redirection.

Open questions

- Define a standard location/rotation policy for `logs/` artifacts.
- Consider adding a small helper (`scripts/test-output.js`) to print just summaries to chat after reading logs.
