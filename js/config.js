/**
 * Configuration file for Vibe game
 * Set your API keys and settings here
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Validate required environment variables
 */
function validateEnvironment() {
  const warnings = [];
  const errors = [];

  // GitHub token validation
  if (!process.env.GITHUB_TOKEN) {
    warnings.push(
      'GITHUB_TOKEN not set - GitHub API requests will be rate limited'
    );
  } else if (process.env.GITHUB_TOKEN.length < 20) {
    errors.push('GITHUB_TOKEN appears to be invalid (too short)');
  }

  // Port validation
  const ticketPort = parseInt(process.env.TICKET_API_PORT);
  if (isNaN(ticketPort) || ticketPort < 1000 || ticketPort > 65535) {
    warnings.push(
      `Invalid TICKET_API_PORT: ${process.env.TICKET_API_PORT}, using default 3001`
    );
  }

  const devPort = parseInt(process.env.DEV_SERVER_PORT);
  if (isNaN(devPort) || devPort < 1000 || devPort > 65535) {
    warnings.push(
      `Invalid DEV_SERVER_PORT: ${process.env.DEV_SERVER_PORT}, using default 5500`
    );
  }

  // Log warnings and errors
  warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));
  errors.forEach((error) => console.error(`❌ ${error}`));

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  return { warnings: warnings.length, errors: errors.length };
}

const CONFIG = {
  // GitHub API Configuration
  GITHUB: {
    TOKEN: process.env.GITHUB_TOKEN || null,
    API_URL: 'https://api.github.com',
    OWNER: 'edwardfalk',
    REPO: 'vibe',
    RATE_LIMIT: {
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000,
    },
  },

  // Ticket API Configuration
  TICKET_API: {
    PORT: parseInt(process.env.TICKET_API_PORT) || 3001,
    HOST: process.env.TICKET_API_HOST || 'localhost',
    get BASE_URL() {
      return `http://${this.HOST}:${this.PORT}/api/tickets`;
    },
  },

  // Development Server Configuration
  DEV_SERVER: {
    PORT: parseInt(process.env.DEV_SERVER_PORT) || 5500,
  },

  // CodeRabbit Integration
  CODERABBIT: {
    AUTO_TICKETS: process.env.CODERABBIT_AUTO_TICKETS === 'true',
    REVIEW_THRESHOLD: process.env.CODERABBIT_REVIEW_THRESHOLD || 'high',
    MAX_SUGGESTIONS: 50,
  },

  // Security Settings
  SECURITY: {
    NODE_ENV: process.env.NODE_ENV || 'development',
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  },

  // File System Paths
  PATHS: {
    BUG_REPORTS: 'tests/bug-reports',
    SCREENSHOTS: 'tests/screenshots',
    LOGS: 'logs',
  },

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

// Validate environment on module load
const validation = validateEnvironment();
console.log(
  `🔧 Configuration loaded (${validation.warnings} warnings, ${validation.errors} errors)`
);

// Export for use in other files
export { CONFIG };
