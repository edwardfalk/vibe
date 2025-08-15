// Lightweight liveness probe for Playwright to import in the browser context
// Ensures core systems exist and returns a concise status object

const probe = (() => {
  const playerExists = Boolean(window.player);
  const audioExists = Boolean(window.audio);
  const gameStateObj = window.gameState || null;
  const state = gameStateObj?.gameState ?? null;

  let failure = null;
  if (!playerExists) failure = 'Missing player';
  else if (!audioExists) failure = 'Missing audio';
  else if (!gameStateObj) failure = 'Missing gameState';

  return {
    failure,
    playerAlive: playerExists,
    state,
  };
})();

export default probe;
