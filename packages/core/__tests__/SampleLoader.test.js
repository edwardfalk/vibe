import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { SampleLoader } from '../src/audio/SampleLoader.js';

// Helper to create a fake Response object similar to the Fetch API
function createJsonResponse(data) {
  return {
    ok: true,
    json: async () => data,
  };
}

describe('SampleLoader.load()', () => {
  // Mock for global fetch
  const manifest = {
    kick: 'kick.mp3',
    snare: 'snare.mp3',
  };
  let originalFetch;

  beforeAll(() => {
    // Mock Tone.Players to avoid heavy dependency and network XHRs
    vi.mock('tone', () => {
      class FakePlayer {
        constructor() {
          this.buffer = { _buffer: { length: 1, duration: 1 } };
        }
        connect() {}
        disconnect() {}
      }
      class FakePlayers {
        /** @param {Record<string,string>} manifest */
        constructor(manifest) {
          this._players = {};
          for (const id of Object.keys(manifest)) {
            this._players[id] = new FakePlayer();
          }
          // emulate Tone->AudioNode API for `.toDestination()` chain
          return this;
        }
        toDestination() {
          return this;
        }
        get loaded() {
          return Promise.resolve();
        }
      }
      return {
        Players: FakePlayers,
      };
    });

    originalFetch = global.fetch;
    global.fetch = vi.fn(() => createJsonResponse(manifest));
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('loads manifest and returns players with no failedIds', async () => {
    const { players, failedIds } = await SampleLoader.load('fake/url/manifest.json');

    expect(Object.keys(players._players)).toEqual(Object.keys(manifest));
    expect(failedIds.length).toBe(0);
  });
});

