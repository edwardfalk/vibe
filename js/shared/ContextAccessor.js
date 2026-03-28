/**
 * Creates a context value getter that checks GameContext.get(),
 * then direct property access, then window globals.
 */
export function createContextAccessor(contextRef) {
  return function getContextValue(key) {
    const context =
      typeof contextRef === 'function' ? contextRef() : contextRef;
    if (context && typeof context.get === 'function') {
      return context.get(key);
    }
    if (context && key in context) {
      return context[key];
    }
    return typeof window !== 'undefined' ? window[key] : undefined;
  };
}
