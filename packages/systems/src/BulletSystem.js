/* BulletSystem.js - Updates player & enemy bullets and handles off-screen culling.
 * Extracted from GameLoop for modularity.
 */

export class BulletSystem {
  static update() {
    if (!window.playerBullets || !window.enemyBullets) return;

    // --- Player bullets ----------------------------------------------------
    for (let i = window.playerBullets.length - 1; i >= 0; i--) {
      const bullet = window.playerBullets[i];
      bullet.update();
      if (bullet.isOffScreen()) {
        window.playerBullets.splice(i, 1);
      }
    }

    // --- Enemy bullets -----------------------------------------------------
    for (let i = window.enemyBullets.length - 1; i >= 0; i--) {
      const bullet = window.enemyBullets[i];
      bullet.update();
      if (bullet.isOffScreen()) {
        console.log(
          `➖ Removing enemy bullet (off-screen): ${bullet.owner} at (${Math.round(
            bullet.x
          )}, ${Math.round(bullet.y)}) - Remaining: ${window.enemyBullets.length - 1}`
        );
        window.enemyBullets.splice(i, 1);
      }
    }
  }
}
