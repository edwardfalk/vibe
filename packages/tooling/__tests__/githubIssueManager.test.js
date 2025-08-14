import { expect, test, beforeEach, afterEach } from 'bun:test';
import { createIssue } from '../src/githubIssueManager.js';

let originalFetch;
let originalToken;
let originalRepo;

beforeEach(() => {
  // Preserve originals
  originalFetch = globalThis.fetch;
  originalToken = process.env.GITHUB_TOKEN;
  originalRepo = process.env.GITHUB_REPO;
});

afterEach(() => {
  // Restore originals
  globalThis.fetch = originalFetch;
  process.env.GITHUB_TOKEN = originalToken;
  process.env.GITHUB_REPO = originalRepo;
});

test('throws when GITHUB_TOKEN is missing', async () => {
  process.env.GITHUB_TOKEN = '';
  process.env.GITHUB_REPO = 'owner/repo';
  await expect(createIssue({ title: 'Test issue' })).rejects.toThrow(
    'GITHUB_TOKEN'
  );
});

test('creates issue and returns issue number', async () => {
  process.env.GITHUB_TOKEN = 'dummy_token';
  process.env.GITHUB_REPO = 'owner/repo';
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({
        number: 123,
        html_url: 'https://github.com/owner/repo/issues/123',
      }),
    };
  };

  const num = await createIssue({
    title: 'Probe: sample',
    body: 'body',
    labels: ['bug'],
  });
  expect(num).toBe(123);
});
