# Design

Vibe's one idea: **enemies are the band.** Every enemy attack is a drum hit on a shared beat, so the fight writes its own soundtrack. The more enemies you face, the bigger the band.

## Beat roles

At 120 BPM in 4/4 time (a beat every 500 ms):

| Who     | When                      | Plays like      |
| ------- | ------------------------- | --------------- |
| Player  | held fire on eighth notes | hi-hat          |
| Grunt   | fires on beats 2 and 4    | snare           |
| Tank    | fires on beat 1           | kick            |
| Stabber | lunges on beat 3.5        | off-beat accent |
| Rusher  | explodes on beats 1 and 3 | crash           |

The attacks are also pitched apart so they don't mask each other: tank shots low (about 90 Hz), grunt shots in the middle (about 950 Hz) and stabber attacks high (about 2.2 kHz). The tank's tones are square waves: laptop speakers can't play 90 Hz itself, but they do play its overtones. Its shot adds a short electric zap that falls from 1.2 kHz, below the stabbers. The presets are in `js/audio/SoundConfig.js`.

A steady kick (four on the floor by default) and a sub-bass pulse keep time under everything. Without them, enemy hits are just sounds. With them, you can hear that the hits land on the beat. The kick's sound and pattern are in `CONFIG.BEAT_TRACK`.

## Player fire

The first shot of a burst fires the moment you press, so the controls feel instant. While fire stays held (mouse, Space or Shift), later shots snap to eighth notes: if a shot is due off the grid, `queueShot()` holds it until the next eighth note. A shot that was queued still fires if you let go before it lands, so a quick tap never loses its shot.

## Level progression

Levels come from score, not waves. Enemies spawn continuously in waves that land on a beat.

All the numbers are in `CONFIG.PACING`:

- the score needed for each level;
- the beats between waves, which shrink as levels go up;
- how many enemies can be on screen, which grows every second level up to a cap.

New types join by level: grunts from level 1, stabbers at 2, rushers at 3 and tanks at 5. Halfway through the level before a new type arrives, one enemy of that type appears once per run as a preview.

## The mix

Enemies speak through the browser's speech synthesis, which runs outside Web Audio and can't be turned up past full volume. So the voices stay on top by the mix keeping the beat lower and dipping the game while anyone speaks:

- effects dip by `DUCK_SFX_DB`;
- the beat dips less (`DUCK_BEAT_DB`), because it keeps time;
- both come back over `DUCK_RELEASE_SEC`.

The levels are in `CONFIG.MIX`. The kick, the mix and pacing can all be tuned live by opening the game with `?tune`.
