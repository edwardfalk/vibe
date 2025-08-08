// SampleLoader.js – Stand-alone helper for loading a Tone.Players set from a manifest.
// Keeping it tiny and generic so it can be reused outside ToneAudioFacade.

import * as Tone from 'tone';

export class SampleLoader {
  /**
   * Load samples listed in a JSON manifest.
   * @param {string} manifestUrl – Path to JSON { id:url } map.
   * @param {(m:Record<string,string>)=>Record<string,string>} [remapFn] – Optional URL remapper.
   * @returns {Promise<{ players: Tone.Players, failedIds: string[] }>}
   */
  static async load(manifestUrl, remapFn = (m) => m) {
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error('Failed to fetch audio manifest');
    const manifest = remapFn(await res.json());

    const players = new Tone.Players(manifest).toDestination();
    await players.loaded; // Wait for all XHRs to settle

    // Detect empty buffers (some CDNs may 404 yet return 200+0-byte)
    const failedIds = [];
    for (const [id, player] of Object.entries(players._players)) {
      const buf = player.buffer?._buffer;
      if (!buf || !buf.length || buf.duration === 0) {
        failedIds.push(id);
      }
    }

    return { players, failedIds };
  }
}

export default SampleLoader;
