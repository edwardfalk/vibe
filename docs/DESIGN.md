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

The attacks are also pitched apart so they don't mask each other: tank shots low (about 90 Hz), grunt shots in the middle (about 950 Hz) and stabber attacks high (about 2.2 kHz). The rusher's crash is a cymbal above them all: everything in it is high-passed at 5 kHz, so nothing sits in the kick's band. The tank's tones are square waves: laptop speakers can't play 90 Hz itself, but they do play its overtones. Its shot adds a short electric zap that falls from 1.2 kHz, below the stabbers. The presets are in `js/audio/SoundConfig.js`.

A steady kick (four on the floor by default) and a sub-bass pulse keep time under everything. Without them, enemy hits are just sounds. With them, you can hear that the hits land on the beat. The kick's sound and pattern are in `CONFIG.BEAT_TRACK`.

## The cast

The hero is the Dude: a long-haired, bearded slacker in a bathrobe and jelly sandals, a White Russian in his other hand, black shades his only protection. He is looking for his carpet ("that carpet really tied the room together"), and he's sure one of the aliens has it. Calm is his nature, so his anger is the joke. He is the only one who walks: a foot lands on every eighth note, the hi-hat he fires on, and space cracks under it. Standing, he nods on the beat. As they hurt him his face goes red, an anger vein throbs on the kick, his shades narrow into a glare, and near the end steam puffs from under his hair and he glows red on the kick. A hit knocks his shades crooked and spills his drink. His shield is a bubble that swells on the kick, shatters when it takes a hit and pops back on the beat. The look and its numbers are in `js/entities/PlayerRenderer.js` and `CONFIG.PLAYER_LOOK`.

The aliens live in space. There is no ground, so they never walk: they hover, on boosters or whatever else they have. Grunts are stupid, whiny and clumsy: each is a droplet of jelly in a helmet far too small, its eyes pointing two different ways, hovering on one jet that now and then coughs.

Grunts dance together. Every grunt crouches as 2 and 4 come, the beats they fire on. One that fires hops on its jet's puff and squashes as it lands; the rest give a small hop and slump back. Through the beat before a shot a grunt winds up (its antennae go amber, then white-hot); when it holds its fire instead, it sulks. They stop while the game is paused. The look and its numbers are in `js/entities/GruntRenderer.js` and `CONFIG.GRUNT_LOOK`.

The tank is a vain muscle bully, the grunts' big brother: a bouncer from space, seen from above, all shoulders, with a small shiny bald head, sunglasses and a gold chain. His armour (a chest guard and two shoulder pads) sits on the side he faces; his back is bare. He turns only on beat 1, his kick, a heavy step of at most 60°, and lurches forward on it; between kicks he holds his facing, so you can get round him. Stand in front of him and he shoves you on the beat, with a whump of its own. His charge takes two bars and fires on beat 1: his chain lights a link a beat, and the cannon goes amber, then white-hot for the last half-beat. His ball kills any smaller alien in its way, but another tank only takes a dent: tanks are inconvenienced by each other, not killed, so you can't just wait for them to shoot each other. They try not to, too: a tank with another in his line of fire steps sideways, so around a hero who stays put they spread round him, each with a clear shot.

The time bomb is the hero's weapon against tanks. You plant it by touching a tank's bare back, shouting "TIMEBOMB!". It rides there, counts "3, 2, 1" in your voice on the beat from the beat after that, and blows on the sixth beat, with the kick, and kills the tank it is on: the blast hits him from his own back and the plasma it leaves finishes him. It hurts everything else near it too, you included, so run: the ring round it shows how far and how long. The look and its numbers are in `js/entities/TankRenderer.js`, `CONFIG.TANK`, `CONFIG.TANK_LOOK` and `CONFIG.BOMB`.

The rusher is the family's reckless little cousin, who thinks blowing up is the best party there is: a stuntman from space riding a hot-pink rocket like a motorbike, in a star-spangled helmet and a cape. He steers only on the beat. On every beat he boosts toward you, turning at most 100°, and between beats he flies dead straight: dash aside just after a boost and he shoots past and has to loop round. Shoot him, or let him get close, and he lights. He stops, pops a wheelie and waves to the crowd, and the ring at his blast's reach counts the beats to the first beat 1 or 3 at least two beats on, losing an arc a beat: amber for the last, white-hot for the last half-beat. Then he goes off with a crash. He is your firework too: his blast kills the grunts round him and lights any rusher it reaches, which goes off two beats later, crash … crash. Your shots knock him along their path, so you can bat a lit rusher into a crowd. The look and its numbers are in `js/entities/RusherRenderer.js`, `CONFIG.RUSHER` and `CONFIG.RUSHER_LOOK`.

## The sky

The steady kick is the one instrument you also see. The sky is a nebula around a young star cluster. On every kick you hear, the cluster breathes and the dense gas lights up from inside; on beat 1 a pressure front also rolls out through the gas. On beats where the kick doesn't play, the sky only drifts. It grows with the level: sparse, cool teal at level 1; by level 8 the cluster has blown a bubble walled with rust and ochre gas.

This is BeatTrack's steady kick, not the tank's beat-1 part. The older per-beat flashes are gone, so the sky is the one visual beat apart from the cast's own moves: the hero's stride on the eighths and his nod, with his anger and his bubble throbbing on the kick, the grunts' dance, the tank's kick, turn and swagger, and the rusher's boost on every beat (see The cast). Its numbers are in `CONFIG.SKY`.

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

## Pausing

Pausing (P) freezes the game, its sound and the sky. The audio is suspended, which stops the beat clock too, so on unpause the music, the kick and every enemy pick up exactly where they stopped. A line being spoken is cut. With `?tune` the sound plays on while paused (its "Sound while paused" box), so the kick can be tuned by ear; untick it to hear a real pause.
