# Design

Vibe's one idea: **enemies are the band.** Every enemy attack is a hit on a shared beat (the drums, and the stabber's strings), so the fight writes its own soundtrack. The more enemies you face, the bigger the band.

## Beat roles

At 120 BPM in 4/4 time (a beat every 500 ms):

| Who     | When                      | Plays like                    |
| ------- | ------------------------- | ----------------------------- |
| Player  | held fire on eighth notes | hi-hat                        |
| Grunt   | fires on beats 2 and 4    | snare                         |
| Tank    | fires on beat 1           | kick                          |
| Stabber | lunges on beat 3.5        | string stab (off-beat accent) |
| Rusher  | explodes on beats 1 and 3 | crash                         |

The attacks are also pitched apart so they don't mask each other, each on its own notes of the hum's scale, so they sound in key: tank shots low (an 808 boom landing on his root), grunt shots in the middle (each grunt his own minor third or fifth) and the stabber's strings high (on the sour note outside the hum's scale). The rusher's crash is a cymbal above them all: everything in it is high-passed at 5 kHz, so nothing sits in the kick's band. The tank's boom is driven: laptop speakers can't play his low root itself, but they do play the overtones the drive adds. A short electric zap falls on top of it from his fifth, high up, below the stabbers. Every pitched sound names who plays it and a note, never a frequency (the presets in `js/audio/SoundConfig.js`, the band's instruments in `js/audio/Instruments.js`), and each player keeps to its own notes: the tank his root and fifth, the grunts their minor third and fifth, the rusher his seventh and root, the hero his root and fifth. Two sounds walk further: the tank's charge climbs the whole scale, and the grunts' whine slides up from the second. Copies fired together start a few milliseconds apart and are slightly detuned (`CONFIG.TONES`), tones by chance and the band's instruments by each creature's own seed, so grunts firing together don't sit exactly on each other. The stabber's strings are in `js/audio/StabberStrings.js`.

A hit on an enemy plays one sound, his own, on his note, at once: feedback can't wait for the beat. As he weakens it climbs the scale, so you hear a stabber or a tank getting close. A tank's armour plate rings his fifth and never climbs. Their level and climb are in `CONFIG.HITS`.

A steady kick (four on the floor by default) keeps time under everything. Without it, enemy hits are just sounds. With it, you can hear that the hits land on the beat. The kick's sound and pattern are in `CONFIG.BEAT_TRACK`.

## The hum

The universe has a tone as well as a beat. Under everything plays a hum: one root note and its fifth, two detuned saws on the root, a saw on the fifth and a low sine through a soft filter, in a dark synthwave colour. The root never changes key (F# by default), but it drifts a few cents, slowly, like an old analog synth, and every tuned sound takes the same drift. The kick's thump ends on the root.

The hum dips on every beat, kick or not, and swells back, and its filter opens over one bar and closes over the next. It grows with the levels: from level 3 a saw an octave higher, from level 5 a shimmer of high fifths. It brightens as enemies fill the screen and settles when the run ends. It sits about 5 dB under the kick above 250 Hz, where laptop speakers play, and dips with the effects while anyone speaks. The pitch grid is `js/audio/Harmony.js`, the hum `js/audio/Hum.js`, and its settings are in `CONFIG.HUM`.

## The cast

The hero is the Dude: a long-haired, bearded slacker in a bathrobe and jelly sandals, a White Russian in his other hand, black shades his only protection. He is looking for his carpet ("that carpet really tied the room together"), and he's sure one of the aliens has it. Calm is his nature, so his anger is the joke. He is the only one who walks: a foot lands on every eighth note, the hi-hat he fires on, and space cracks under it. Standing, he nods on the beat. As they hurt him his face goes red, an anger vein throbs on the kick, his shades narrow into a glare, and near the end steam puffs from under his hair and he glows red on the kick. A hit knocks his shades crooked and spills his drink. His shield is a bubble that swells on the kick, shatters when it takes a hit and pops back on the beat. The look and its numbers are in `js/entities/PlayerRenderer.js` and `CONFIG.PLAYER_LOOK`.

The aliens live in space. There is no ground, so they never walk: they hover, on boosters or whatever else they have. Grunts are stupid, whiny and clumsy: each is a droplet of jelly in a helmet far too small, its eyes pointing two different ways, hovering on one jet that now and then coughs.

Grunts dance together. Every grunt crouches as 2 and 4 come, the beats they fire on. One that fires hops on its jet's puff and squashes as it lands; the rest give a small hop and slump back. Through the beat before a shot a grunt winds up (its antennae go amber, then white-hot); when it holds its fire instead, it sulks. Its shot is a synthwave stab, each grunt on his own note, and now and then one chatters in his own voice, a whine or a squeak. They stop while the game is paused. The look and its numbers are in `js/entities/GruntRenderer.js` and `CONFIG.GRUNT_LOOK`.

The tank is a vain muscle bully, the grunts' big brother: a bouncer from space, seen from above, all shoulders, with a small shiny bald head, sunglasses and a gold chain. His armour (a chest guard and two shoulder pads) sits on the side he faces; his back is bare. He turns only on beat 1, his kick, a heavy step of at most 60°, and lurches forward on it; between kicks he holds his facing, so you can get round him. Stand in front of him and he shoves you on the beat, with a whump of its own. His charge takes two bars and fires on beat 1: his chain lights a link a beat while a pluck climbs a step of the scale a beat, louder as he strains, and the cannon goes amber, then white-hot for the last half-beat. His shot is an 808 boom with a zap on top. His ball kills any smaller alien in its way, but another tank only takes a dent: tanks are inconvenienced by each other, not killed, so you can't just wait for them to shoot each other. They try not to, too: a tank with another in his line of fire steps sideways, so around a hero who stays put they spread round him, each with a clear shot. The look and its numbers are in `js/entities/TankRenderer.js`, `CONFIG.TANK` and `CONFIG.TANK_LOOK`.

The time bomb is the hero's weapon against tanks. You plant it by touching a tank's bare back, shouting "TIMEBOMB!". It rides there, counts "3, 2, 1" in your voice on the beat, from the first beat at least two beats after the shout starts, so the shout is said whole, and blows on the sixth beat, with the kick, and kills the tank it is on outright, from his own back. The beat before, he realises: he looks round at it, then his hands fly off his cannon, a drop of sweat pops out, and he says "UH, OH". The bang is an inked fireball and a white-hot ring that slams to a stop at its reach, so you see where it stops hurting; it hurts everything else in reach too, you included, most at its middle, so run: the ring round the bomb shows how far and how long. Its sound falls onto the hum's root with the fifth over it, and a thud lands as the ring stops. It leaves one cloud of smoke whose edge is where it hurts: within 80 px for five seconds, then a smaller 60 px smoulder for ten more; it hums the root under crackles on the eighths. It is drawn and counted in `js/systems/BombSystem.js` (the bang in `js/effects/explosions/BombBlast.js`, the cloud's look in `BombSmoke.js`, its damage in `HazardCloud.js`); its numbers are in `CONFIG.BOMB`, `CONFIG.PLASMA` and `CONFIG.DEBRIS`.

Every death is the character's own, and comic, never gory. A grunt bursts like a water balloon: it hangs frozen where it was hit, swelling, its eyes going wide, and pops on the next eighth note into a few jelly blobs; its little helmet spins off, and its two eyes float away still looking two ways, blink once each and shrink away. Its whine slides down onto the hum's minor third, and grunts popping together strum a chord. When the Dude takes his fatal hit the run is over, but for one bar the world holds still while the beat goes on (a bomb's bang that killed him plays out): his blaster is knocked away, his White Russian drifts off pouring a milky trail, and he lies back, flat as on a lilo, on a carpet that isn't there; his anger drains (one last puff of steam) back to his calm smirk, the camera eases in, he sighs his last breath (a soft pad an octave under his note, on the hum's grid, gliding down a whole tone) and says his death line, and then GAME OVER. A tank dies all air: his shades and gold chain are blown off, then the air rushes out of the hole in his back and he darts about like a let-go balloon while his skin goes slack, and drifts away, a big sad face on a small wrinkled skin, his squeal sliding down onto the hum's root. Killed by the bomb he goes with its bang; any other way, on the next eighth note. A plate shot off him clangs, a ring of sheet metal on the hum's F#. The stabber's own death is still to come: for now it bursts into fragments, with a falling cry on his notes. The deaths are in `js/entities/GruntDeath.js`, `DudeDeath.js` and `TankDeath.js` (his "uh oh" in `TankFlinch.js`), their sounds in `js/audio/DeathSounds.js` and the bomb's in `BombSounds.js`, their numbers in `CONFIG.DEATHS`.

The rusher is the family's reckless little cousin, who thinks blowing up is the best party there is: a stuntman from space riding a hot-pink rocket like a motorbike, in a star-spangled helmet and a cape. He steers only on the beat. On every beat he boosts toward you, turning at most 100°, and between beats he flies dead straight: dash aside just after a boost and he shoots past and has to loop round. Shoot him, or let him get close, and he lights. He stops, pops a wheelie and waves to the crowd, and the ring at his blast's reach counts the beats to the first beat 1 or 3 at least two beats on, losing an arc a beat: amber for the last, white-hot for the last half-beat. He beeps the countdown, a note a beat, the last the highest. Then he goes off with a crash. He is your firework too: his blast kills the grunts round him and lights any rusher it reaches, which goes off two beats later, crash … crash. Your shots knock him along their path, so you can bat a lit rusher into a crowd. The look and its numbers are in `js/entities/RusherRenderer.js`, `CONFIG.RUSHER` and `CONFIG.RUSHER_LOOK`.

The stabber is the family's evil psycho, still funny: a strange thing from a strange world, built round one bone spike, and polite about it ("HOLD STILL, PLEASE!"). Seen from above, it is a pointed gold shell over rippling magenta flesh, with one slit-pupilled eye that watches you, two jointed claws it rows with and tendrils curling behind; nobody can say what animal it is. It stalks you at a distance and attacks in one phrase on the beat: on beat 2 it winds up, its spike growing a notch an eighth; on beat 3 its aim locks, its claws fold flat into a dart and the spike goes white-hot; on the "and" of 3 it lunges. A ring round it counts the eighths (gold, amber, white-hot) and a lane shows where it will go. Shoot it before the lock and the stab is off and it reels, dazed; after the lock it is committed, and only dodging helps. Its lunge hits whatever it meets first, you or a grunt in the way. Each phrase plays strings on its own sour note: a tremolo through the wind-up, a stab at the lock, a screech at the lunge, a pizzicato when the spike lands. The look and its numbers are in `js/entities/StabberRenderer.js`, `CONFIG.STABBER` and `CONFIG.STABBER_LOOK`.

## The sky

The steady kick is the one instrument you also see. The sky is a nebula around a young star cluster. On every kick you hear, the cluster breathes and the dense gas lights up from inside; on beat 1 a pressure front also rolls out through the gas. On beats where the kick doesn't play, the sky only drifts. It grows with the level: sparse, cool teal at level 1; by level 8 the cluster has blown a bubble walled with rust and ochre gas.

This is BeatTrack's steady kick, not the tank's beat-1 part. Apart from the sky, the beat shows only in the cast's own moves (see The cast). Its numbers are in `CONFIG.SKY`.

## Player fire

The first shot of a burst fires the moment you press, so the controls feel instant. While fire stays held (mouse, Space or Shift), later shots snap to eighth notes: if a shot is due off the grid, `queueShot()` holds it until the next eighth note. A shot that was queued still fires if you let go before it lands, so a quick tap never loses its shot.

Its sound lands exactly on the eighth: held fire fires up to 20 ms before the line, and the sound waits for it (a shot that fires after its eighth plays at once). It is one of four sounds from the listening page, chosen on `?tune`: a soft hat, a metal hat, a tuned tick on the root five octaves up (the default), or the soft hat with a ghost arpeggio walking the chord under it. The "and" is a little louder than the beat, like a dance beat, and a long burst softens. The sounds are in `js/audio/Instruments.js`, their numbers in `CONFIG.HERO_SHOT`.

## Level progression

Levels come from score, not waves. Enemies spawn continuously in waves that land on a beat.

All the numbers are in `CONFIG.PACING`:

- the score needed for each level;
- the beats between waves, which shrink as levels go up;
- how many enemies can be on screen, which grows every second level up to a cap.

New types join by level: grunts from level 1, stabbers at 2, rushers at 3 and tanks at 5. Each is previewed once per run: halfway through a level, one enemy of the next type still to come appears (`PREVIEW_AT_PROGRESS`). The tank's preview comes at level 3, and level 4 has none.

## The mix

Everyone speaks through the game's own speech engines, SAM and espeak-ng, each speaker in its own voice and effect chain. Every line is levelled to the same loudness, kept under a ceiling, and starts on the beat grid, like everything else that sounds. The voices stay on top by the mix keeping the beat lower and dipping the game while anyone speaks:

- effects dip by `DUCK_SFX_DB`;
- the beat dips less (`DUCK_BEAT_DB`), because it keeps time;
- both come back over `DUCK_RELEASE_SEC`.

The levels are in `CONFIG.MIX`. The kick, the hum, the mix and pacing can all be tuned live by opening the game with `?tune`.

Who speaks how often is in `CONFIG.SPEECH_SETTINGS`, also on `?tune`. Each enemy chatters about once every 20 to 30 seconds, on its own beat. The tank calls out "CHARGING!" and "FIRE!" on a quarter of his charges; the rest are his plucks alone, so his boasts get a turn. A line within `VOICE_GAP_SEC` of the last is dropped, not queued. The hero and the enemies keep separate gaps, so an enemy's line never holds the hero back.

## Pausing

Pausing (P) freezes the game, its sound and the sky. The audio is suspended, which stops the beat clock too, so on unpause the music, the kick and every enemy pick up exactly where they stopped. A line being spoken holds mid-word and finishes on unpause. With `?tune` the sound plays on while paused (its "Sound while paused" box), so the kick can be tuned by ear; untick it to hear a real pause.
