export function withWatchdog(promise, label, ms = 5000) {
  const timer = setTimeout(() => {
    console.error(`⏳ WATCHDOG: ${label} timed out after ${ms}ms`);
    process.exitCode = 124; // timeout code
    try {
      process.exit(124);
    } catch {}
  }, ms);
  return Promise.resolve(promise)
    .then((v) => {
      clearTimeout(timer);
      return v;
    })
    .catch((e) => {
      clearTimeout(timer);
      console.error(`❌ ${label} failed:`, e?.message || e);
      process.exit(1);
    });
}
