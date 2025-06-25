// RemoteConsoleLogger.js - Browser-side automatic console logger
// Requires fetch API (modern browsers). Sends console logs to Ticket API server
// so that they are persisted to .debug logs for later analysis.

// IMPORTANT: This module should only execute in a browser context.
function setupRemoteConsoleLogger(apiUrl = 'http://localhost:3001/api/logs') {
  if (typeof window === 'undefined') return; // Node/test safeguard
  if (window.__remoteConsoleLoggerSetup) return;
  window.__remoteConsoleLoggerSetup = true;
  window.__remoteLoggerApiUrl = apiUrl; // Store for global error handlers

  const levels = ['log', 'info', 'warn', 'error'];

  levels.forEach((level) => {
    const original = console[level] ? console[level].bind(console) : null;
    let failureCount = 0; // track consecutive POST failures
    let disabled = false;
    console[level] = (...args) => {
      if (disabled) {
        if (original) original(...args);
        return;
      }
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
          failureCount += 1;
          if (failureCount >= 3 && !disabled) {
            disabled = true;
            console.warn(
              '🪵 RemoteConsoleLogger disabled after 3 failed attempts'
            );
          }
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

  // Helper to disable external handlers after repeated failures
  const markDisabled = () => {
    if (!window.__remoteLoggerDisabled) {
      window.__remoteLoggerDisabled = true;
      console.warn(
        '🪵 RemoteConsoleLogger global handlers disabled after repeated failures'
      );
    }
  };

  let globalFailureCount = 0;

  const postLog = (payload) => {
    return fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {
      globalFailureCount += 1;
      if (globalFailureCount >= 3) markDisabled();
    });
  };
}

export { setupRemoteConsoleLogger };

// -----------------------------------------------------------------------------
// Attach global error handlers so that uncaught exceptions make it to the server
// even if console.error is not explicitly called.
// -----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  // Helper to get API URL from window or fallback
  const getApiUrl = () => window.__remoteLoggerApiUrl || 'http://localhost:3001/api/logs';
  // Uncaught synchronous errors
  window.addEventListener('error', (event) => {
    if (window.__remoteLoggerDisabled) return;
    fetch(getApiUrl(), {
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
    });
  });

  // Unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    if (window.__remoteLoggerDisabled) return;
    fetch(getApiUrl(), {
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
    });
  });
}
