# Hang-Probe Suite

Quick scripts to isolate terminal hanging in Cursor when using Bun.

- Each script has a watchdog timeout. If it times out, it prints a WATCHDOG line.
- Run them one by one:

```bat
bun scripts/hang-probe/hp1-node-exit.js
bun scripts/hang-probe/hp2-import-fs.js
bun scripts/hang-probe/hp3-read-rules.js
bun scripts/hang-probe/hp4-spawn-bunx-echo.js
bun scripts/hang-probe/hp5-import-project-module.js
```

Record results below.

## Results Log
- hp1:
- hp2:
- hp3:
- hp4:
- hp5:
