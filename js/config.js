/**
 * Configuration file for Vibe game
 * Set your API keys and settings here
 */

const CONFIG = {
  // Google Cloud Text-to-Speech API Key (loaded from environment variable)
  // Create a `.env` file with `GOOGLE_CLOUD_TTS_API_KEY=your-key`
  GOOGLE_CLOUD_TTS_API_KEY:
    (typeof process !== 'undefined' &&
      process.env &&
      process.env.GOOGLE_CLOUD_TTS_API_KEY) ||
    '',

  // TTS Settings
  TTS_SETTINGS: {
    // Set to true to use Google Cloud TTS (requires API key)
    // Set to false to use browser's built-in Web Speech API
    USE_CLOUD_TTS: false,

    // Enable audio effects (reverb, distortion, etc.)
    ENABLE_AUDIO_EFFECTS: true,

    // Cache TTS audio to improve performance
    ENABLE_AUDIO_CACHE: true,
  },

  // Game Settings
  GAME_SETTINGS: {
    // Enable verbose logging for debugging
    DEBUG_MODE: false,
    // Enable verbose collision debug logging (per-frame/per-entity)
    DEBUG_COLLISIONS: false,
    // Enable periodic performance diagnostics logs and snapshots
    PERF_DIAGNOSTICS: false, // true logs a frame-time report to the console
    // Frames between performance diagnostics reports
    PERF_LOG_INTERVAL_FRAMES: 300,

    // Frame time at 60fps baseline, used to normalize deltaTimeMs
    FRAME_TIME_MS: 16.6667,

    // Canonical world dimensions for all systems
    WORLD_WIDTH: 1150,
    WORLD_HEIGHT: 850,

    // Speech frequency (seconds between ambient speech)
    SPEECH_FREQUENCY: {
      MIN: 5,
      MAX: 15,
    },
  },

  // Beat timing tolerances (fraction of beat/subdivision interval)
  BEAT_TOLERANCES: {
    ON_BEAT: 0.2, // 20% of beat interval (100ms at 120 BPM)
    QUARTER_BEAT: 0.1, // 10% of quarter-beat interval (50ms at 120 BPM)
    EIGHTH_NOTE: 0.08, // 8% of eighth-note interval (40ms at 120 BPM)
  },

  // Speech/Chatter Settings (per enemy type, in seconds)
  SPEECH_SETTINGS: {
    DEFAULT: {
      AMBIENT_MIN: 5, // seconds
      AMBIENT_MAX: 15,
      COOLDOWN: 10, // seconds between speeches
    },
    GRUNT: {
      AMBIENT_MIN: 3,
      AMBIENT_MAX: 8,
      COOLDOWN: 4,
    },
    TANK: {
      AMBIENT_MIN: 8,
      AMBIENT_MAX: 20,
      COOLDOWN: 12,
    },
    RUSHER: {
      AMBIENT_MIN: 4,
      AMBIENT_MAX: 10,
      COOLDOWN: 6,
    },
    STABBER: {
      AMBIENT_MIN: 6,
      AMBIENT_MAX: 14,
      COOLDOWN: 8,
      CHANT_MIN: 3, // seconds between chants
      CHANT_MAX: 6,
    },
  },

  // Pacing: how fast levels come and enemies (instruments) join.
  // Tune live by opening the game with ?tune in the URL.
  PACING: {
    FIRST_LEVEL_POINTS: 100, // score for level 2 (a kill is 10, more on a streak)
    LEVEL_POINTS_PER_LEVEL: 120, // leaving level N (N >= 2) costs N x this
    SPAWN_INTERVAL_BEATS: 6, // beats between spawn waves at level 1
    // Waves come this many beats sooner per level; waves land on whole beats,
    // so 0.5 speeds up one beat every second level (6, 6, 5, 5, 4 ...)
    SPAWN_INTERVAL_DROP_PER_LEVEL: 0.5,
    MIN_SPAWN_INTERVAL_BEATS: 4,
    BASE_MAX_ENEMIES: 2, // on screen at level 1; +1 every second level
    MAX_ENEMIES_CAP: 6,
    // A taste of what's coming: once per run, a single enemy of the next
    // new type appears when this far through the level before it
    PREVIEW_NEW_ENEMY: true,
    PREVIEW_AT_PROGRESS: 0.5,
  },

  // Mix. Speech runs outside Web Audio and can't go above full volume, so it
  // sits on top by keeping the beat lower and dipping the game while anyone
  // speaks. Tune live with ?tune.
  MIX: {
    SFX_VOLUME: 1, // game sound effects master
    BEAT_TRACK_VOLUME: 0.22, // kick + sub pulse, after the drive (was 0.4)
    SPEECH_VOLUME: 1, // multiplies every voice's volume
    SPEECH_DISTANCE_FLOOR: 0.7, // far-off enemies still this loud (was 0.4)
    DUCK_SFX_DB: -6, // effects dip while someone speaks
    DUCK_BEAT_DB: -3, // the kick dips less: it keeps time
    DUCK_RELEASE_SEC: 0.3,
    DUCK_MAX_HOLD_MS: 5000, // never stay ducked longer than this after a line starts
  },

  // Beat track: the steady kick and the sub pulse under it.
  // Tune live by opening the game with ?tune in the URL.
  BEAT_TRACK: {
    KICK: {
      ENABLED: true,
      PATTERN: 'four', // 'four' = every beat, 'oneThree' = beats 1 and 3
      VOLUME: 0.6, // peak gain, before the beat track's master volume
      PITCH_START_HZ: 150, // punch; laptop speakers need energy up here
      PITCH_END_HZ: 45, // body
      PITCH_DROP_SEC: 0.08, // how fast the pitch falls to the body
      DECAY_SEC: 0.3, // length of the thump
      // Saturation: adds overtones of the body, so small speakers that can't
      // play the bass itself still let you hear it. 0 = clean sine.
      DRIVE: 4,
      CLICK_LEVEL: 0.5, // noise attack ("beater"), relative to VOLUME
      CLICK_DECAY_SEC: 0.015,
      CLICK_FREQ_HZ: 2500, // centre of the click's band; hearing peaks ~2-4 kHz
    },
    SUB_PULSE: {
      ENABLED: true,
      VOLUME: 1, // multiplier on the original sub-bass pulse
    },
  },

  // Stabber-specific tunable parameters
  STABBER_SETTINGS: {
    MIN_STAB_DISTANCE: 200, // Minimum distance to initiate stab
    MAX_STAB_DISTANCE: 350, // Maximum distance to initiate stab
    MAX_PREPARE_TIME: 45, // Frames for preparation phase
    MAX_WARNING_TIME: 40, // Frames for warning phase
  },
};

export const VOICE_CONFIG = {
  player: { rate: 0.85, pitch: 0.15, volume: 1 },
  grunt: { rate: 0.85, pitch: 1.8, volume: 0.8 },
  rusher: { rate: 1.4, pitch: 1.5, volume: 0.8 },
  tank: { rate: 0.5, pitch: 0.2, volume: 0.9 },
  stabber: { rate: 0.8, pitch: 2.0, volume: 0.8 },
};

// Export for use in other files
export { CONFIG };
