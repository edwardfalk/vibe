// DEPRECATED: RemoteConsoleLogger moved to @vibe/tooling
console.warn(
  'RemoteConsoleLogger.js has moved to @vibe/tooling. Update your imports.'
);
export { setupRemoteConsoleLogger } from '../packages/tooling/src/RemoteConsoleLogger.js';

// RemoteConsoleLogger.js - Browser-side automatic console logger
// Requires fetch API (modern browsers). Sends console logs to Ticket API server
// so that they are persisted to .debug logs for later analysis.

// IMPORTANT: This module should only execute in a browser context.
function setupRemoteConsoleLogger(apiUrl = 'http://localhost:3001/api/logs') {
  if (typeof window === 'undefined') return; // Node/test safegaurd
  if (window.__remoteConsoleLoggerSetup) return;
  window.__remoteConsoleLoggerSetup = true;

  const levels = ['log', 'info', 'warn', 'error'];

  levels.forEach((level) => {
    const original = console[level] ? console[level].bind(console) : null;
    console[level] = (...args) => {
      try {
        // Stringify args for transport (avoid circular refs)
        const msg = args
          .map((a) => {
            if (typeof a === 'string') return a;
            try {
              return JSON.stringify(a);
            } catch (_) {
              return '[Unserializable]';
            }
          })
          .join(' ');

        fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ level, message: msg }),
          keepalive: true, // allow sendBeacon-like behavior on unload
        }).catch(() => {
          /* network failure ignored */
        });
      } catch (_) {
        // Ignore logging failures
      }

      if (original) {
        original(...args);
      }
    };
  });

  console.log(
    '🪵 RemoteConsoleLogger active – logs will be sent to Ticket API'
  );
}

// -----------------------------------------------------------------------------
// Attach global error handlers so that uncaught exceptions make it to the server
// even if console.error is not explicitly called.
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  // Uncaught synchronous errors
  window.addEventListener('error', (event) => {
    try {
      fetch('http://localhost:3001/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: event.message || 'Uncaught error',
          stack: event.error
            ? event.error.stack
            : event.filename + ':' + event.lineno,
        }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    try {
      fetch('http://localhost:3001/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level: 'error',
          message: event.reason
            ? event.reason.message || String(event.reason)
            : 'Unhandled rejection',
          stack: event.reason && event.reason.stack ? event.reason.stack : '',
        }),
        keepalive: true,
      }).catch(() => {});
    } catch (_) {}
  });
}
