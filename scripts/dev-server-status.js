// scripts/dev-server-status.js
// Shows what process (if any) is running on port 5500 (and 3001)
import { execSync } from 'child_process';

function checkPort(port) {
  try {
    const output = execSync(`netstat -ano | findstr :${port}`);
    const lines = output.toString().split('\n').filter(Boolean);
    if (lines.length === 0) {
      console.log(`Port ${port} is free.`);
      return;
    }
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      try {
        const tasklist = execSync(`tasklist /FI "PID eq ${pid}"`).toString();
        const match = tasklist.match(/^(\S+)/m);
        const procName = match ? match[1] : 'Unknown';
        console.log(`Port ${port} is used by PID ${pid} (${procName})`);
      } catch {
        console.log(`Port ${port} is used by PID ${pid} (process name unknown)`);
      }
    }
  } catch {
    console.log(`Port ${port} is free.`);
  }
}

console.log('--- Dev Server Status ---');
checkPort(5500);
checkPort(3001);
