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

    // Volume multiplier for all TTS (0.0 to 1.0)
    TTS_VOLUME: 0.6,

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
    PERF_DIAGNOSTICS: false,
    // Frames between performance diagnostics reports
    PERF_LOG_INTERVAL_FRAMES: 300,

    // Canonical world dimensions for all systems
    WORLD_WIDTH: 1150,
    WORLD_HEIGHT: 850,

    // Speech frequency (seconds between ambient speech)
    SPEECH_FREQUENCY: {
      MIN: 5,
      MAX: 15,
    },
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

  // Stabber-specific tunable parameters
  STABBER_SETTINGS: {
    MIN_STAB_DISTANCE: 200, // Minimum distance to initiate stab
    MAX_STAB_DISTANCE: 350, // Maximum distance to initiate stab
    MAX_PREPARE_TIME: 45, // Frames for preparation phase
    MAX_WARNING_TIME: 40, // Frames for warning phase
  },
};

// Export for use in other files
export { CONFIG };
