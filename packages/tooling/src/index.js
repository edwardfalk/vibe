// Tooling package barrel file
// Exports for issue management, probes, and debug utilities

// Expose tooling utilities for browser context
export { setupRemoteConsoleLogger } from './RemoteConsoleLogger.js';

// Dynamically import GitHub Issue Manager for browser context
if (typeof window !== 'undefined') {
  import('./githubIssueManager.js').catch(() => {
    console.warn('⚠️ Failed to load githubIssueManager');
  });
}
