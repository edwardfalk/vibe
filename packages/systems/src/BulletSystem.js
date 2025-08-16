/* BulletSystem.js - Updates player & enemy bullets and handles off-screen culling.
 * Extracted from GameLoop for modularity.
 */

export class BulletSystem {
  static update() {
    const gs = window.gameState;
    if (!gs) return;

    const playerBullets = gs.playerBullets;
    const enemyBullets = gs.enemyBullets;

    // --- Player bullets ----------------------------------------------------
    for (let i = playerBullets.length - 1; i >= 0; i--) {
      const bullet = playerBullets[i];
      bullet.update();
      if (bullet.isOffScreen()) {
        playerBullets.splice(i, 1);
      }
    }

    // --- Enemy bullets -----------------------------------------------------
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
      const bullet = enemyBullets[i];
      bullet.update();
      if (bullet.isOffScreen()) {
        console.log(
          `➖ Removing enemy bullet (off-screen): ${bullet.owner} at (${Math.round(
            bullet.x
          )}, ${Math.round(bullet.y)}) - Remaining: ${enemyBullets.length - 1}`
        );
        enemyBullets.splice(i, 1);
      }
    }
  }
}
