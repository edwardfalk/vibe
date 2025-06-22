// Configuration for Vibe game (moved to @vibe/core)

// Conditionally load dotenv only in Node.js environment
let processEnv = {};
try {
  if (typeof process !== 'undefined' && process.env) {
    processEnv = process.env;
    // Load .env in Node context for local dev – ignored in browser
    try {
      // Dynamically import dotenv without top-level await to preserve browser compatibility
      import('dotenv')
        .then((dotenv) => {
          // Some bundlers put the exports on `.default`
          const dot = dotenv.default || dotenv;
          if (typeof dot.config === 'function') {
            dot.config();
          }
        })
        .catch(() => {
          /* Ignore if dotenv fails to load (e.g., browser context) */
        });
      processEnv = process.env;
    } catch (_) {
      /* dotenv not available or cannot be loaded in this context */
    }
  }
} catch (_) {
  /* process undefined in browser – ignore */
}

function validateEnvironment() {
  const warnings = [];
  const errors = [];

  if (!processEnv.GITHUB_TOKEN) {
    warnings.push(
      'GITHUB_TOKEN not set - GitHub API requests will be rate limited'
    );
  } else if (processEnv.GITHUB_TOKEN.length < 20) {
    errors.push('GITHUB_TOKEN appears to be invalid (too short)');
  }

  const ticketPort = parseInt(processEnv.TICKET_API_PORT);
  if (isNaN(ticketPort) || ticketPort < 1000 || ticketPort > 65535) {
    warnings.push(
      `Invalid TICKET_API_PORT: ${processEnv.TICKET_API_PORT}, using default 3001`
    );
  }

  const devPort = parseInt(processEnv.DEV_SERVER_PORT);
  if (isNaN(devPort) || devPort < 1000 || devPort > 65535) {
    warnings.push(
      `Invalid DEV_SERVER_PORT: ${processEnv.DEV_SERVER_PORT}, using default 5500`
    );
  }

  warnings.forEach((warning) => console.warn(`⚠️ ${warning}`));
  errors.forEach((error) => console.error(`❌ ${error}`));

  if (errors.length > 0) {
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }

  return { warnings: warnings.length, errors: errors.length };
}

const CONFIG = {
  GITHUB: {
    TOKEN: processEnv.GITHUB_TOKEN || null,
    API_URL: 'https://api.github.com',
    OWNER: 'edwardfalk',
    REPO: 'vibe',
    RATE_LIMIT: {
      MAX_RETRIES: 3,
      RETRY_DELAY: 1000,
    },
  },
  TICKET_API: {
    PORT: parseInt(processEnv.TICKET_API_PORT) || 3001,
    HOST: processEnv.TICKET_API_HOST || 'localhost',
    get BASE_URL() {
      return `http://${this.HOST}:${this.PORT}/api/tickets`;
    },
  },
  DEV_SERVER: {
    PORT: parseInt(processEnv.DEV_SERVER_PORT) || 5500,
  },
  CODERABBIT: {
    AUTO_TICKETS: processEnv.CODERABBIT_AUTO_TICKETS === 'true',
    REVIEW_THRESHOLD: processEnv.CODERABBIT_REVIEW_THRESHOLD || 'high',
    MAX_SUGGESTIONS: 50,
  },
  SECURITY: {
    NODE_ENV: processEnv.NODE_ENV || 'development',
    LOG_LEVEL: processEnv.LOG_LEVEL || 'info',
  },
  PATHS: {
    BUG_REPORTS: 'tests/bug-reports',
    SCREENSHOTS: 'tests/screenshots',
    LOGS: 'logs',
  },
  GOOGLE_CLOUD_TTS_API_KEY: processEnv.GOOGLE_CLOUD_TTS_API_KEY || '',
  TTS_SETTINGS: {
    USE_CLOUD_TTS: false,
    TTS_VOLUME: 0.6,
    ENABLE_AUDIO_EFFECTS: true,
    ENABLE_AUDIO_CACHE: true,
  },
  GAME_SETTINGS: {
    DEBUG_MODE: false,
    DEBUG_COLLISIONS: false,
    WORLD_WIDTH: 1150,
    WORLD_HEIGHT: 850,
    SPEECH_FREQUENCY: {
      MIN: 5,
      MAX: 15,
    },
  },
  SPEECH_SETTINGS: {
    DEFAULT: { AMBIENT_MIN: 5, AMBIENT_MAX: 15, COOLDOWN: 10 },
    GRUNT: { AMBIENT_MIN: 3, AMBIENT_MAX: 8, COOLDOWN: 4 },
    TANK: { AMBIENT_MIN: 8, AMBIENT_MAX: 20, COOLDOWN: 12 },
    RUSHER: { AMBIENT_MIN: 1, AMBIENT_MAX: 3, COOLDOWN: 2 },
    STABBER: {
      AMBIENT_MIN: 6,
      AMBIENT_MAX: 14,
      COOLDOWN: 8,
      CHANT_MIN: 3,
      CHANT_MAX: 6,
    },
  },
  STABBER_SETTINGS: {
    MIN_STAB_DISTANCE: 200,
    MAX_STAB_DISTANCE: 350,
    MAX_PREPARE_TIME: 45,
    MAX_WARNING_TIME: 40,
  },
};

const validation = validateEnvironment();
console.log(
  `🔧 Configuration loaded (${validation.warnings} warnings, ${validation.errors} errors)`
);

export { CONFIG };
