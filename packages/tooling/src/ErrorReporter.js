// packages/tooling/src/ErrorReporter.js
// --------------------------------------
// Single-responsibility helper for structured error output.
// All project scripts should call reportError to print a JSON block
// that is machine-parseable by AI assistants and CI readers.
//
// Standard shape:
// {
//   error: true,
//   type: 'ERROR_CODE',
//   message: 'Human-readable summary',
//   timestamp: ISO_STRING,
//   details: { ...optional }
// }

export function reportError(type, message, details = {}, exitCode = 1) {
  const payload = {
    error: true,
    type,
    message,
    timestamp: new Date().toISOString(),
    details,
  };

  // Print to stderr as single line for easy parsing
  console.error(JSON.stringify(payload));

  if (exitCode !== null) {
    process.exit(exitCode);
  }
}
