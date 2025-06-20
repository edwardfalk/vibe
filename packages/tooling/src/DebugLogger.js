// DebugLogger.js (migrated from js/ to packages/tooling/src/)
// Usage: DebugLogger.log('message', optionalErrorObject)
// Logs are written to .debug/YYYY-MM-DD.log

import { mkdirSync, existsSync, appendFileSync } from 'fs';
import { join } from 'path';

const DEBUG_DIR = join(process.cwd(), '.debug');

/**
 * DebugLogger: Static logger for error/debug messages to .debug folder
 */
export class DebugLogger {
  /**
   * Logs a message and optional error object to the .debug folder with a timestamp.
   * @param {string} message - The debug or error message
   * @param {Error|object} [err] - Optional error object for stack trace or details
   */
  static log(message, err) {
    try {
      if (!existsSync(DEBUG_DIR)) {
        mkdirSync(DEBUG_DIR);
      }
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const timeStr = now.toISOString();
      let logMsg = `[${timeStr}] ${message}`;
      if (err) {
        logMsg += `\n${err.stack || JSON.stringify(err)}`;
      }
      logMsg += '\n';
      const logFile = join(DEBUG_DIR, `${dateStr}.log`);
      appendFileSync(logFile, logMsg, 'utf8');
    } catch (e) {
      // Fallback: print to console if file logging fails
      console.log('⚠️ DebugLogger failed:', e);
    }
  }
} 