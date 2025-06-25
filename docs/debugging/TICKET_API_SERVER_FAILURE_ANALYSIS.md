# Ticket API Server Failure Analysis (2025-06-23)

## 1. Summary of Issue

The agent is currently unable to test the ticketing system because the backend API server (`ticket-api.js`) fails to start and run correctly. Attempts to launch the server via `bun run dev`, `bun run api`, and direct execution with `bun ticket-api.js` all result in the server being unreachable on `http://localhost:3001`.

This issue is compounded by severe instability in the PowerShell terminal, which repeatedly crashes with `PSReadLine` errors, making interactive debugging difficult and unreliable.

## 2. Chronology of Events & Observations

1.  **Initial Goal:** Test the ticket system (Create, Update, Close, Delete).
2.  **First Action:** Attempt to list existing tickets using `httpie` (`http GET http://localhost:3001/api/tickets`).
    *   **Result:** Command failed. `http` was not a recognized command.
3.  **Second Action:** Switched to `curl` (`curl -X GET http://localhost:3001/api/tickets`).
    *   **Result:** The PowerShell terminal crashed with a `System.ArgumentOutOfRangeException` within the `PSReadLine` module. This indicates a critical instability in the shell environment.
4.  **Third Action:** Attempted to fix the terminal by running the provided `scripts/powershell/fix-psreadline.ps1` script.
    *   **Result:** The script initially failed due to a file encoding error (a corrupted emoji character: `âœ¨`).
5.  **Fourth Action:** Corrected the broken character in `fix-psreadline.ps1` and re-ran the script.
    *   **Result:** The terminal crashed again with the same `PSReadLine` error, indicating the issue is not with the script but with the terminal session itself.
6.  **Fifth Action:** Hypothesized the API server was not running. I attempted to start it with `bun run dev` in the background.
    *   **Result:** The command appeared to start but subsequent `curl` requests to the API endpoint failed with a "Connection refused" error.
7.  **Sixth Action:** Suspected a port conflict. Ran `bun run predev` to kill ports 5500 and 3001, then attempted to start the API alone with `bun run api`.
    *   **Result:** Still no connection. Running `bun run api` in the foreground revealed an `EADDRINUSE` (Address Already In Use) error, and a cryptic stack trace pointing to a double-server start. This strongly suggested a recursive loop or misconfiguration in how `bun run` was executing the script.
8.  **Seventh Action:** Attempted to break the potential loop by changing the `package.json` script from `"api": "bun run ticket-api.js"` to `"api": "bun ticket-api.js"`.
    *   **Result:** This did not solve the issue. The server remained unreachable. (This change was reverted).
9.  **Eighth Action:** Tried running the server directly (`bun ticket-api.js`) after killing the port.
    *   **Result:** The server was still unreachable. The terminal instability continued, making it difficult to see if any new errors were being logged.

## 3. Root Cause Hypotheses

### Hypothesis A: Compounding Terminal Instability
The `PSReadLine` module in the PowerShell terminal is critically unstable. This is not just an annoyance; it may be corrupting the environment in which `bun` processes are launched, leading to unpredictable behavior, including the failure to properly release file handles or network sockets.

### Hypothesis B: `bun run` Execution Bug on Windows
There may be a bug in how `bun run` or `bunx` executes scripts within this specific Windows PowerShell environment. The `EADDRINUSE` error, despite repeated port killing, suggests that `bun run api` might be spawning a child process and then immediately trying to spawn another on the same port, or that the process is not terminating correctly.

### Hypothesis C: Zombie Process or Port Conflict
A process is holding port 3001 hostage, and `kill-port` is not effective at terminating it completely. This "zombie" process prevents any new server from binding to the port.

### Hypothesis D: System-Level Driver Conflict (User-Provided)
The user has reported that Windows Update may have recently installed an older, incompatible Intel graphics driver. This is known to cause high CPU usage in the "System" process and can lead to instability in system components, including PowerShell and its `PSReadLine` module. This provides a strong underlying reason for the symptoms described in Hypothesis A.

## 4. Proposed Solutions & Verification

### Solution for A & B (Terminal and Bun Issues)

*   **Action 1: Isolate the Server from the Shell:** Instead of running the API in the interactive terminal, execute it via a detached process in `cmd.exe` to bypass PowerShell and `PSReadLine` entirely.
    ```powershell
    # Kill the port one last time for a clean slate
    bunx kill-port 3001
    
    # Use cmd.exe to launch bun in a new, separate window
    Start-Process cmd -ArgumentList "/c, bun ticket-api.js"
    
    # Give it a moment to start
    Start-Sleep -Seconds 5
    ```
*   **Verification 1:** A new `cmd` window should appear and stay open, showing the `[INFO] ✅ Bun Ticket API running...` log.
*   **Verification 2:** The following `curl` command in the main (buggy) PowerShell terminal should succeed and write ticket data to `tickets.json`.
    ```powershell
    curl http://localhost:3001/api/tickets > tickets.json ; cat tickets.json
    ```

### Solution for C (Zombie Process)

*   **Action 2: Manual Process Identification and Termination:** Use lower-level system commands to find and kill the process using the port.
    ```powershell
    # Find the Process ID (PID) using the port
    $processId = (Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue).OwningProcess
    if ($processId) {
        Write-Host "Process with ID $processId is using port 3001. Terminating."
        # Forcefully stop the process
        Stop-Process -Id $processId -Force
    } else {
        Write-Host "Port 3001 is free."
    }
    ```
*   **Verification:** After running the above, `(Get-NetTCPConnection -LocalPort 3001).OwningProcess` should return nothing. The server should then be able to start successfully using the detached method from Action 1.

## 5. Next Steps

My primary recommendation is to attempt **Solution A/B, Action 1**. It has the highest probability of success by completely sidestepping the environmental issues observed. If it works, we can proceed with testing. If it fails, the problem is almost certainly a bug within the `ticket-api.js` script itself, and we will need to pivot to code-level debugging.

**Update:** Given the new information about a potential driver issue, this approach is even more strongly recommended as it directly mitigates the impact of the unstable PowerShell environment. 

---
## 6. Further Testing & Analysis (Post-Initial Document)

### Test 1: Code-Level Debugging
- **Action:** Added extensive `console.log` statements to `ticket-api.js` to trace execution flow.
- **Procedure:** Ran the instrumented script in a detached `cmd` window with output redirected to `api-debug.log`.
- **Result:** The log file showed that `ticket-api.js` ran to completion, but *then* `bun`'s runtime threw the `EADDRINUSE` error.
- **Conclusion:** This confirmed Bun was trying to start a server twice: once from our script's `Bun.serve()` call, and once by its own runner interpreting the `export default server`.

### Test 2: `import.meta.main` Fix
- **Action:** Modified `ticket-api.js` to only call `Bun.serve()` inside an `if (import.meta.main)` block. This should prevent the double-start.
- **Procedure:** Killed port, started server via `bun run api` in the background, waited 5s, then used `curl`.
- **Result:** `curl` still failed to connect. The server was not running.

### Test 3: User-Initiated Manual Run
- **Action:** The user ran `bun run api` directly in their terminal.
- **Result:** The command output provided by the user shows the script is still executing `$ bun run ticket-api.js`. This is the recursive call we identified. The `EADDRINUSE` error persists.
- **Conclusion:** This is the smoking gun. The `package.json` `api` script change (removing the second `run`) was either reverted or not applied correctly in previous attempts. This incorrect script is the direct cause of the `EADDRINUSE` crash.

## 7. Revised Root Cause & Solution

- **Definitive Root Cause:** The `api` script in `package.json` is `"bun run ticket-api.js"`, which causes `bun` to recursively call itself, leading to two processes trying to use port 3001.
- **Definitive Solution:** The `api` script **must** be changed to `"api": "bun ticket-api.js"`. This, combined with the `if (import.meta.main)` guard in `ticket-api.js`, will ensure the server only starts once.

### Next Action Plan
1.  Apply the `package.json` fix.
2.  Kill port 3001.
3.  Run `bun run api` in the background.
4.  Wait 5 seconds.
5.  `curl http://localhost:3001/api/tickets` to verify. This time, it is expected to succeed.

---
## 8. Final Attempt & Conclusion

- **Action:** The definitive `package.json` fix was applied, changing the `api` script to `bun ticket-api.js`.
- **Procedure:** The full action plan (kill port, run api, wait, curl) was executed.
- **Result:** **FAILURE.** `curl` still failed with "Connection refused".
- **Final Conclusion:** The issue is not solvable with the current tools and environment. Despite fixing a definite recursive call bug, the server still fails to launch silently. This points to a fundamental, low-level incompatibility between the Bun runtime and this specific, unstable Windows environment (potentially caused by the graphics driver and PowerShell issues). The agent cannot diagnose this further and recommends exploring alternative runtime environments or debugging the `bun` executable itself. The agent is blocked. 

---
## 9. Foundational System Health Checklist & Remediation Plan

### 9.1. Core Requirements for a Stable Dev Environment

**A. Operating System & Drivers**  ← **FOCUS: Start here!**

#### Specific Tasks & Checks

1. **Windows Update & System Health**
   - Check Windows Update history for recent driver changes/rollbacks.
   - Ensure all critical and security updates are installed (except problematic drivers).
   - Check for any failed or pending updates.

2. **Graphics Driver Verification**
   - Identify current graphics driver version (Intel, NVIDIA, etc.).
   - Compare installed version to latest from manufacturer (not Windows Update).
   - Check for multiple/old driver files in `C:\Windows\System32\DriverStore\FileRepository\` and `C:\Windows\System32\drivers\`.
   - Check Device Manager for warnings, errors, or duplicate display adapters.
   - Confirm no "Microsoft Basic Display Adapter" is active.

3. **Remove/Block Bad Drivers**
   - Uninstall problematic drivers via Device Manager (with "Delete the driver software for this device" checked).
   - Use tools like DDU (Display Driver Uninstaller) if needed (manual step).
   - Block Windows Update from reinstalling bad drivers (Group Policy, registry, or wushowhide.diagcab).

4. **Install Correct Drivers**
   - Download latest drivers directly from Intel/NVIDIA/AMD (not via Windows Update).
   - Install and reboot.
   - Confirm correct version is active in Device Manager and via `dxdiag`.

5. **System Stability Checks**
   - After reboot, check Task Manager: "System" process CPU usage at idle (<1–2% after 10+ min).
   - Check Event Viewer for driver or hardware errors (System log).
   - Confirm no new yellow/red warnings in Device Manager.

6. **Optional: Additional Hardware/OS Checks**
   - Run `sfc /scannow` and `DISM /Online /Cleanup-Image /RestoreHealth` to check for OS corruption.
   - Check for firmware/BIOS updates if hardware is very out of date.

**B. Terminal Environment**
- PowerShell 7.x is fully functional (no PSReadLine or buffer errors, no random crashes).
- If PowerShell cannot be stabilized, a robust alternative terminal (e.g., Windows Terminal, CMD, or a WSL2 shell) is available and tested.
- All required CLI tools (bun, curl, git, etc.) are in PATH and work in the chosen terminal.

**C. Bun Runtime**
- Bun is installed and working (`bun --version` returns expected output).
- Bun can run a trivial server script (e.g., "hello world" HTTP server) without error.

**D. Network/Port Health**
- No zombie processes or port conflicts (especially on 3001, 5500).
- Tools like `Get-NetTCPConnection` and `Stop-Process` work as expected.

---

### 9.2. Remediation Steps (Planned, Not Executed Yet)

#### 1. Graphics Driver Sanity
- Identify and remove any problematic Intel graphics drivers.
- Block Windows Update from reinstalling the bad driver (use Group Policy, device manager, or third-party tools).
- Install the correct, latest driver from the manufacturer's site.
- Reboot and verify "System" process CPU usage is normal.

#### 2. Terminal/PowerShell Health
- Reset or reinstall PowerShell 7.x.
- Test for PSReadLine errors; if present, try alternative terminals (Windows Terminal, CMD, or WSL2).
- Document which terminal is stable and use it for all further work.

#### 3. Bun Runtime Sanity
- Test `bun --version` and a minimal Bun script in the chosen terminal.
- If Bun fails, reinstall or try a different version.

#### 4. Port/Process Hygiene
- Use `Get-NetTCPConnection` and `Stop-Process` to ensure no zombie processes.
- Document a clean workflow for killing ports before server starts.

#### 5. Verification Steps
- After each remediation, document the verification method (e.g., idle CPU check, running a test script, etc.).
- Only proceed to higher-level debugging once all foundational checks pass.

---

**Next Step:**
Once each foundational step is verified, proceed to application-level debugging and testing. 

---
## 10. System Information & Performance Data

This section collects all relevant system information, hardware specs, driver details, and performance data to support troubleshooting and optimization.

### 10.1. What to Collect
- CPU model, core/thread count, and current utilization
- RAM size, speed, and usage
- Storage devices (type, model, health, free space)
- GPU(s) (model, driver version, VRAM)
- Network adapters (model, driver version)
- BIOS/firmware version
- Windows version/build
- All installed drivers (name, version, date, provider)
- Device Manager status (any errors/warnings)
- Windows Update history (especially driver updates)
- Event Viewer logs (System, Application, Driver events)
- Running processes and background services
- Startup programs
- DPC latency and interrupt stats
- Power plan and settings
- Any known performance bottlenecks or issues

### 10.2. Collected Data

*(Paste or summarize collected data here as it is gathered. Use subsections for each category above.)* 