/**
 * Game settings. Values marked for tuning can also be changed live by opening
 * the game with ?tune in the URL (js/dev/TunePanel.js).
 */

const CONFIG = {
  // Game Settings
  GAME_SETTINGS: {
    // Frame time at 60fps baseline, used to normalize deltaTimeMs
    FRAME_TIME_MS: 16.6667,

    // Canonical world dimensions for all systems
    WORLD_WIDTH: 1150,
    WORLD_HEIGHT: 850,
  },

  // Beat timing tolerances (fraction of beat/subdivision interval)
  BEAT_TOLERANCES: {
    ON_BEAT: 0.2, // 20% of beat interval (100ms at 120 BPM)
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
    // Enemies appear this far (px) past an edge of the view. At most 175:
    // with the view centred, only the left and right edges have that much
    // world beyond them
    SPAWN_MARGIN: 50,
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

  // Rusher fuse and blast. Shot (or close enough), a rusher brakes to a stop
  // and blows on the first beat 1 or 3 after FUSE_MIN_MS, so a player who
  // runs gets away. Tune live with ?tune.
  RUSHER: {
    FUSE_MIN_MS: 1000, // shortest fuse; the blast waits for beat 1 or 3 after it
    BRAKE: 0.85, // share of speed kept per frame while lit (0 = instant stop)
    EXPLOSION_RADIUS: 150,
    EXPLOSION_DAMAGE: 35,
  },

  // Hazard clouds. A tank's death leaves plasma; its bomb leaves plasma and
  // longer-lasting debris. Anything within RADIUS takes DAMAGE every
  // DAMAGE_INTERVAL frames for DURATION frames; MAX_RADIUS is how far the
  // cloud is drawn.
  PLASMA: {
    RADIUS: 80,
    MAX_RADIUS: 120,
    DURATION: 300,
    DAMAGE_INTERVAL: 30,
    DAMAGE: 15,
  },
  DEBRIS: {
    RADIUS: 60,
    MAX_RADIUS: 90,
    DURATION: 900,
    DAMAGE_INTERVAL: 45,
    DAMAGE: 8,
  },

  // Hit radius per enemy type (px from centre), so shots that visibly touch
  // an enemy count; sprites reach well past size/2. Tune live with ?tune;
  // SHOW draws the circles.
  HITBOX: {
    SHOW: false,
    grunt: 22,
    rusher: 14,
    stabber: 18,
    tank: 42,
  },

  // The hero: a shield that takes one real hit whole, then recharges and
  // returns on the beat; slow healing once he's gone a while unhit.
  // Contact ticks (1 per frame) bypass the shield. Tune live with ?tune.
  PLAYER: {
    SHIELD_RECHARGE_MS: 8000,
    REGEN_DELAY_MS: 3000, // healing starts this long after the last hit
    REGEN_PER_SEC: 2, // health points per second
    // Knockback: a push of this many px/frame that fades by KNOCKBACK_DECAY
    // (share kept per frame), so it carries him about force x 6.7 px in all
    KNOCKBACK_DECAY: 0.85,
    KNOCKBACK_STAB: 8,
    KNOCKBACK_RUSHER_BLAST: 12,
    KNOCKBACK_AREA: 6, // hazard clouds
    KNOCKBACK_BOMB: 15,
  },

  // Tank armour plates (hits to break). Applies to tanks spawned after a
  // change. Front 45 / sides 30: about 25 s of held fire to kill one
  // head-on, as before the double-shot fix. Tune live with ?tune.
  TANK_ARMOR: {
    FRONT: 45,
    SIDE: 30,
  },

  // Stabber-specific tunable parameters
  STABBER_SETTINGS: {
    MIN_STAB_DISTANCE: 200, // Minimum distance to initiate stab
    MAX_STAB_DISTANCE: 350, // Maximum distance to initiate stab
    MAX_WARNING_TIME: 40, // Frames for warning phase
    KNOCKBACK_FORCE: 8, // px/frame per hit; about 53 px in total
    MAX_KNOCKBACK: 20, // px/frame cap under steady fire
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
