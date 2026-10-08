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
    // Enemies appear this far (px) past an edge of the view: past a tank's
    // spawn ring (1.5 × its size of 50) plus the biggest screen shake (15).
    // At most 125: with the view centred, that's the world beyond the top
    // and bottom edges
    SPAWN_MARGIN: 95,
  },

  // Mix. Speech runs outside Web Audio and can't go above full volume, so it
  // sits on top by keeping the beat lower and dipping the game while anyone
  // speaks. Tune live with ?tune.
  MIX: {
    SFX_VOLUME: 1, // game sound effects master
    BEAT_TRACK_VOLUME: 0.22, // the kick, after the drive (was 0.4)
    SPEECH_VOLUME: 1, // multiplies every voice's volume
    SPEECH_DISTANCE_FLOOR: 0.7, // far-off enemies still this loud (was 0.4)
    DUCK_SFX_DB: -6, // effects dip while someone speaks
    DUCK_BEAT_DB: -3, // the kick dips less: it keeps time
    DUCK_RELEASE_SEC: 0.3,
    DUCK_MAX_HOLD_MS: 5000, // never stay ducked longer than this after a line starts
  },

  // Pausing (P) stops the sound: the audio is suspended, which also stops
  // BeatClock, so everything picks up where it stopped. ?tune turns this on
  // (its "Sound while paused" box), so the kick can be tuned by ear while
  // paused. Top level, so ?tune's JSON never carries it into this file.
  SOUND_WHILE_PAUSED: false,

  // The universe's hum (js/audio/Hum.js): a root and its fifth under
  // everything, drifting slowly like an old analog synth. It dips on every
  // beat, breathes over two bars, grows at levels 3 and 5 and brightens as
  // enemies fill the screen. Every tuned sound shares its root and drift
  // (js/audio/Harmony.js). Tune live with ?tune. Provisional: re-check
  // LEVEL_DB and CUTOFF_HZ once the effects are in key (the audio
  // overhaul's PR 2).
  HUM: {
    ROOT: 'F#', // the universe's key: E, F, F#, G or A, in the octave up to A1 = 55 Hz
    LEVEL_DB: 0, // added to the listening page's level (Hum.js's TRIM_DB)
    DRIFT_CENTS: 9, // the furthest the root wanders
    DIP: 0.65, // share of the hum's level each beat's dip takes
    BREATH: 0.3, // how far the filter opens and closes over two bars
    CUTOFF_HZ: 420, // the filter's resting brightness
    FIGHT_OPEN: 1, // a full screen opens the filter this much more (1 = twice as bright)
  },

  // Beat track: the steady kick. The hum under it is CONFIG.HUM.
  // Tune live by opening the game with ?tune in the URL.
  BEAT_TRACK: {
    KICK: {
      ENABLED: true,
      PATTERN: 'four', // 'four' = every beat, 'oneThree' = beats 1 and 3
      // The pitch drop ends on the hum's root (with its drift) instead of
      // PITCH_END_HZ; false is the kick as it was
      TUNED: true,
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
  },

  // The sky: a nebula that is the kick drum's body
  // (js/systems/background/NebulaSky.js). Tune live with ?tune; ?sky=full or
  // ?sky=flat in the URL forces a render mode.
  SKY: {
    KICK_STRENGTH: 1, // scales everything the kick does to the sky
    DOWNBEAT_FRONT: 1, // the downbeat's travelling front, against the breath
    OFFBEAT_SHARE: 0.4, // beats 2-4 relative to the downbeat
    PULSE_DECAY_SEC: 0.22, // how long each kick's breath lasts
    OFFSET_MS: 0, // added to the audio latency (base + output); + = the pulse lands later
    LEVEL_OVERRIDE: 0, // 1-8 previews that level's sky; 0 follows the game
    LEVEL_EASE_SEC: 0.5, // how fast the sky follows a level change (floor 0.05)
  },

  // The rusher, a stuntman on a rocket (js/entities/Rusher.js). He steers
  // only on the beat: each new beat he turns toward the hero by at most
  // TURN_STEP_DEG and his booster sets his speed to BOOST_PX_S, which coasts
  // down toward CRUISE_PX_S. Shot, or this close to the hero, he lights: he
  // brakes and blows on the first beat 1 or 3 at least FUSE_MIN_BEATS on,
  // hurting everything within EXPLOSION_RADIUS. Shots push him (PUSH). Tune
  // live with ?tune.
  RUSHER: {
    BOOST_PX_S: 330, // his speed right after each beat's boost
    CRUISE_PX_S: 150, // what it coasts down toward
    BOOST_TAU_SEC: 0.22, // how fast it coasts down
    CHARGE_BOOST: 1.25, // after his battle cry his speed is this much higher
    TURN_STEP_DEG: 100, // the most he turns on one beat
    TURN_SEC: 0.12, // how long that turn takes
    CRY_DIST_PX: 150, // his battle cry, this close to the hero
    PASS_DIST_PX: 160, // the hero getting behind him this close is shooting past
    LIGHT_DIST_PX: 50, // he lights this close to the hero, unshot
    FUSE_MIN_BEATS: 2, // he blows on the first beat 1 or 3 at least this far on
    BRAKE: 0.85, // share of speed kept per 60 Hz frame while lit (0 = instant stop)
    PUSH: true, // shots push him along their path
    PUSH_PX_S: 260, // a shot sets his speed to this, along it
    PUSH_KEEP: 0.3, // plus this share of what it was
    PUSH_BRAKE: 0.95, // and once pushed he brakes this gently, so he slides
    FLIP_COS: 0.3, // drawn upright, he turns round once |cos(heading)| passes this
    EXPLOSION_RADIUS: 150,
    EXPLOSION_DAMAGE: 35,
    CRASH_VOLUME: 1, // the crash's level, times SoundConfig's rusherCrash
  },

  // Hazard clouds. A tank's death leaves plasma; the hero's bomb leaves plasma and
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
    rusher: 18, // the stuntman's rocket and rider
    stabber: 19, // the shiv's shell and claws
    tank: 55, // the Bouncer's shoulders reach about 65 px
  },

  // How the rusher looks (js/entities/RusherRenderer.js). Drawn only; his hit
  // circle is HITBOX.rusher. A new ART_SCALE rebuilds his cached sprites.
  RUSHER_LOOK: {
    ART_SCALE: 1, // 1 = the prototype's proportions at size 22
  },

  // The grunt's look and motion (js/entities/GruntRenderer.js): a jelly that
  // hovers on one jet and dances on the beat. All of it is drawn only; the
  // hit circle is HITBOX.grunt. Tune live with ?tune; a new ART_SCALE
  // rebuilds the cached sprites.
  GRUNT_LOOK: {
    ART_SCALE: 1.15, // drawn size over its size; the hit circle stays
    HOP_PX: 4.5, // the jet's puff on 2 and 4 lifts it this far
    IDLE_DANCE: 0.35, // share of that dance a grunt does on a snare it doesn't fire on
    HOVER_PX: 1.6, // its lazy float
    LEAN_RAD: 0.12, // it leans right on 1 and left on 3
    WANDER_RAD: 0.13, // and is never quite level
    JIGGLE: 0.09, // how much the jelly jiggles after each puff
    COUGH_CHANCE: 0.07, // chance its jet coughs, rolled 9 times a second
    TUMBLE_RAD: 0.35, // its own shot rocks it back this far
    FACING_DEADZONE: 0.17, // it turns round once |cos(aim)| passes this
  },

  // The tank, a bouncer from space (js/entities/Tank.js). He turns only on
  // beat 1, a step at a time; his gun follows his target within an arc; he
  // drifts, and lurches on each beat 1; he shoves a hero in front of him on
  // the beat. Health applies to tanks spawned after a change. Tune with ?tune.
  TANK: {
    HEALTH: 60,
    TURN_STEP_DEG: 60, // the most he turns on one beat 1
    TURN_SEC: 0.4, // how long that turn takes (keep under a bar)
    TURN_DEADZONE_DEG: 3, // a target this close to his facing gets no turn
    AIM_ARC_DEG: 70, // his gun reaches this far either side of his facing
    AIM_TAU_SEC: 0.25, // how sluggishly it follows his target
    DRIFT_PX_S: 14, // between kicks he drifts toward his target
    LURCH_PX_S: 95, // the lurch on each beat 1, at its peak
    LURCH_TAU_SEC: 0.28, // and how fast it dies away
    LURCH_MIN_DIST_PX: 130, // closer than this he holds his ground
    // He keeps his line of fire clear of other tanks: one in his lane (between
    // him and his target, this close to the line: a tank's hit circle plus
    // his ball) makes him step sideways, so tanks spread round the hero
    FIRE_LANE_PX: 70,
    SIDESTEP_PX_S: 40,
    CHARGE_RANGE_PX: 400, // he starts a charge with his target this close
    CHARGE_BEATS: 8, // two bars of straining, then the shot on beat 1
    RECHARGE_BEATS: 8, // from a shot to the next charge
    SHOVE_COOLDOWN_BEATS: 2, // between two shoves from one tank
    SHOT_DAMAGE_TO_TANKS: 10, // another tank's ball only dents him (it kills other aliens)
  },

  // How the tank looks (js/entities/TankRenderer.js). Drawn only; his hit
  // circle is HITBOX.tank. A new ART_SCALE rebuilds his cached sprites.
  TANK_LOOK: {
    ART_SCALE: 1, // 1 = the prototype's proportions at size 50
    SWAGGER: 1, // his shoulder roll on 2, neck roll on 3, knuckle crack on 4
  },

  // The hero's bomb (js/systems/BombSystem.js), planted on a tank's back
  // with a shout of "TIMEBOMB!". It counts "3, 2, 1" on the last three even
  // beats before it blows (beats 0, 2 and 4 of a 6-beat fuse; beat 0 is the
  // first beat at least COUNT_LEAD_BEATS after planting, none said before it) and
  // blows on beat FUSE_BEATS, hurting everything in RADIUS_PX, the tank it
  // is on and the hero too. Damage falls from MAX at its centre to MIN at
  // its reach. Tune live with ?tune.
  BOMB: {
    FUSE_BEATS: 6,
    RADIUS_PX: 250,
    ENEMY_DAMAGE_MIN: 5,
    ENEMY_DAMAGE_MAX: 30,
    PLAYER_DAMAGE_MIN: 10,
    PLAYER_DAMAGE_MAX: 40,
    MAX_ACTIVE: 3,
    COUNT_LEAD_BEATS: 1, // "TIMEBOMB!" gets at least this long before the count
  },

  // The hero: a shield that takes one real hit whole, then recharges and
  // returns on the beat; slow healing once he's gone a while unhit.
  // Contact ticks (1 per frame) bypass the shield. Tune live with ?tune.
  PLAYER: {
    SHIELD_RECHARGE_MS: 15000,
    REGEN_DELAY_MS: 6000, // healing starts this long after the last hit
    REGEN_PER_SEC: 0.5, // health points per second
    // What each hit takes from him (of 100). Enemies hitting each other
    // keep their own numbers.
    DAMAGE_GRUNT_BULLET: 5,
    DAMAGE_TANK_BALL: 50,
    DAMAGE_STAB: 25,
    DAMAGE_TANK_SHOVE: 15, // a tank's shove when he's in front of it
    // Knockback: a push of this many px/frame that fades by KNOCKBACK_DECAY
    // (share kept per frame), so it carries him about force x 6.7 px in all
    KNOCKBACK_DECAY: 0.85,
    KNOCKBACK_STAB: 8,
    KNOCKBACK_RUSHER_BLAST: 12,
    KNOCKBACK_AREA: 6, // hazard clouds
    KNOCKBACK_BOMB: 15,
    KNOCKBACK_TANK_SHOVE: 14, // about 95 px
  },

  // The hero's look (js/entities/PlayerRenderer.js), drawn only. ART_SCALE:
  // drawn size over his size (1 = the prototype's proportions at size 32,
  // about 44 px tall); his hit circle stays size / 2, but his shots leave
  // the drawn gun. A new ART_SCALE rebuilds his sprites. FLIP_COS: he turns
  // round once his aim is this far past straight up or down (cos of it).
  PLAYER_LOOK: {
    ART_SCALE: 1,
    FLIP_COS: 0.3,
  },

  // Deaths (js/entities/GruntDeath.js, DudeDeath.js, js/audio/DeathSounds.js).
  // Volumes: 1 is the prototype page's level. LINGER: how long a grunt's
  // remains and the Dude's milk trail stay, times. The Dude's scene: SCENE_BEATS
  // from his fatal hit to GAME OVER (his choreography takes 2 s; past it he
  // floats on), the camera easing in to SCENE_ZOOM (1: no ease).
  DEATHS: {
    GRUNT_VOLUME: 1,
    BREATH_VOLUME: 1,
    LINGER: 1,
    SCENE_BEATS: 4,
    SCENE_ZOOM: 1.45,
  },

  // Tank armour plates (hits to break). Applies to tanks spawned after a
  // change. Front 45 / sides 30: about 25 s of held fire to kill one
  // head-on, as before the double-shot fix. Tune live with ?tune.
  TANK_ARMOR: {
    FRONT: 45,
    SIDE: 30,
  },

  // The stabber, the shiv (js/entities/Stabber.js). Speeds are px/s. He
  // stalks the hero between STALK_MIN_PX and STALK_MAX_PX; in range on beat
  // 2 (within REACH_SLACK of the band) he winds up, locks on 3 and lunges on
  // the "and" of 3 for LUNGE_SEC, to OVERSHOOT_PX past where the hero stood,
  // then rests REST_BARS whole bars. A hit before the lock cancels the stab.
  // The volumes are his strings' (js/audio/StabberStrings.js), 1 = the
  // prototype page's level. Tune live with ?tune.
  STABBER: {
    STALK_MIN_PX: 200,
    STALK_MAX_PX: 350,
    APPROACH_PX_S: 150, // closing in from further out
    STALK_PX_S: 30, // circling the hero inside the band
    BACKOFF_PX_S: 110, // nearer than the band
    STEER_SEC: 0.25, // how fast his locomotion eases to what he wants
    AIM_SEC: 0.08, // how fast his aim follows the hero (twitchy)
    REACH_SLACK: 1.15, // he winds up within STALK_MAX_PX times this
    DRAWBACK_PX_S: 25, // he eases back from the hero while winding up
    LUNGE_SEC: 0.3, // the lunge, easing out (0.1 to 0.6)
    OVERSHOOT_PX: 60, // past where the hero stood at the lock
    LUNGE_MIN_PX: 160,
    LUNGE_MAX_PX: 420,
    TIP_HIT_PX: 18, // his tip hits the hero this close to his centre
    RECOIL_PX_S: 900, // after a hit he springs back off it
    COAST_PX_S: 300, // after a miss he coasts on
    REST_BARS: 1, // whole bars after a stab's bar before the next wind-up
    KNOCK_PX_S: 480, // a hit's push
    KNOCK_MAX_PX_S: 1200, // capped under steady fire
    KNOCK_DECAY: 0.85, // the push kept per 60 Hz frame
    HEALTH: 10,
    ARMOR: 2, // taken off each hit; at least 1 gets through
    ALIEN_STAB_DAMAGE: 25, // what his stab does to an alien
    TREMOLO_VOLUME: 1,
    STAB_VOLUME: 1, // the stab at the lock and the screech at the lunge
    PLUCK_VOLUME: 1,
  },

  // How the stabber looks (js/entities/StabberRenderer.js). ART_SCALE scales
  // his drawing, his reach, his count ring and his health bar's rise, so it
  // moves where a stab lands; his hit circle is HITBOX.stabber, tuned apart.
  STABBER_LOOK: {
    ART_SCALE: 1, // 1 = the prototype at game size (0.6 to 1.6)
  },

  // Stabber-specific tunable parameters
  STABBER_SETTINGS: {
    MIN_STAB_DISTANCE: 200, // Minimum distance to initiate stab
    MAX_STAB_DISTANCE: 350, // Maximum distance to initiate stab
    MAX_WARNING_TIME: 40, // Frames for warning phase
    KNOCKBACK_FORCE: 8, // px/frame per hit; about 53 px in total
    MAX_KNOCKBACK: 20, // px/frame cap under steady fire
  },
  // The game's own speech engines (js/audio/speech/): each speaker's engine,
  // voice and effect chain. Tune them in voices.html, then paste here.
  SPEECH: {
    TARGET_DB: -20, // RMS loudness every line is matched to, in and out
    PEAK_DB: -1, // ceiling; wins over the target
    REDUCTION_WARN_DB: 3, // the playground warns when fitting the ceiling costs more
    MAX_WAIT_MS: 750, // a line not ready and scheduled by then is dropped, not played late
    // A worker this slow to answer has hung: speech turns off. Long enough
    // for the engines' first download (1.7 MB) on a slow link
    WORKER_TIMEOUT_MS: 60000,
    MAX_LINE_CHARS: 200, // longer text is refused before it reaches an engine
    SPEAKERS: {
      player: {
        engine: 'espeak',
        voice: { variant: 'Mr serious', pitch: 30, range: 40, speed: 150 },
        chain: [{ type: 'reverb', seconds: 1.1, mix: 0.22 }],
        levelDb: 0,
      },
      grunt: {
        engine: 'espeak',
        voice: { variant: 'AnxiousAndy', pitch: 85, range: 70, speed: 175 },
        chain: [
          { type: 'bandpass', freq: 1700, q: 0.9 },
          { type: 'crush', levels: 15 },
        ],
        levelDb: 0,
      },
      stabber: {
        engine: 'sam',
        voice: { pitch: 64, speed: 88, mouth: 200, throat: 150 },
        chain: [
          { type: 'highpass', freq: 480 },
          { type: 'slapback', time: 0.085, feedback: 0.32, mix: 0.29 },
        ],
        levelDb: 0,
      },
      rusher: {
        engine: 'espeak',
        voice: { variant: 'Tweaky', pitch: 72, range: 90, speed: 235 },
        chain: [
          { type: 'drive', amount: 5 },
          { type: 'tremolo', rate: 14, depth: 0.6 },
        ],
        levelDb: 0,
      },
      tank: {
        engine: 'sam',
        voice: { pitch: 125, speed: 105, mouth: 100, throat: 92 },
        chain: [
          { type: 'ringmod', freq: 38, mix: 0.74 },
          { type: 'lowpass', freq: 2400 },
        ],
        levelDb: 0,
      },
    },
    // Words an engine mispronounces, respelled for that engine only; the
    // speech bubble always shows the real word
    RESPELL: { sam: { death: 'deth' }, espeak: {} },
  },
};

// Export for use in other files
export { CONFIG };
