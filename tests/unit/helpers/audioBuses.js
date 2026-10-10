// The game's three group buses (Audio.buses) as stand-ins a test can name
export function fakeBuses() {
  return {
    drums: { kind: 'drums bus' },
    band: { kind: 'band bus' },
    feedback: { kind: 'feedback bus' },
  };
}
