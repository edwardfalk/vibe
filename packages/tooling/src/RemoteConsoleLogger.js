// RemoteConsoleLogger.js - Optional browser-side console logger
// Disabled by default. If enabled and an apiUrl is provided, sends warn/error
// logs to a remote HTTP endpoint for persistence.

// IMPORTANT: This module should only execute in a browser context.
function setupRemoteConsoleLogger(apiUrl) {
  if (typeof window === 'undefined') return; // Node/test safeguard
  if (window.__remoteConsoleLoggerSetup) return;
  // If no endpoint is provided, do not set up
  if (!apiUrl || typeof apiUrl !== 'string' || apiUrl.trim() === '') {
    return;
  }
  window.__remoteConsoleLoggerSetup = true;
  window.__remoteLoggerApiUrl = apiUrl; // Store for global error handlers

  // Global flag to enable/disable remote logging (default: disabled)
  if (typeof window.ENABLE_REMOTE_LOGGING === 'undefined') {
    window.ENABLE_REMOTE_LOGGING = false;
  }

  const levels = ['log', 'info', 'warn', 'error'];

  levels.forEach((level) => {
    const original = console[level] ? console[level].bind(console) : null;
    let failureCount = 0; // track consecutive POST failures
    let disabled = false;
    console[level] = (...args) => {
      if (disabled || !window.ENABLE_REMOTE_LOGGING) {
        if (original) original(...args);
        return;
      }
      try {
        // Only send 'error' and 'warn' remotely
        if (level === 'error' || level === 'warn') {
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
        }
      } catch (_) {
        // Ignore logging failures
      }

      if (original) {
        original(...args);
      }
    };
  });

  console.log('🪵 RemoteConsoleLogger available (disabled by default)');

  // Attach global error listeners once
  if (!window.__remoteGlobalHandlersAttached) {
    window.__remoteGlobalHandlersAttached = true;
    const getApiUrl = () =>
      window.__remoteLoggerApiUrl || 'http://localhost:3001/api/logs';
    // Uncaught errors
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

// Old global handlers removed; now attached lazily inside setupRemoteConsoleLogger
