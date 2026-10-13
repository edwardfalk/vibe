// The record a BeatTrack keeps of the kicks it played (BeatTrack.kicks): one
// on each of `beats` of a grid from `originSec`, a bar's beat 1 a downbeat
export const playedKicks = (beats, beatSec = 0.5, originSec = 0) =>
  beats.map((b) => ({
    at: originSec + b * beatSec,
    downbeat: ((b % 4) + 4) % 4 === 0,
  }));

// Beats from..to, each one
export const beatsFrom = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);
