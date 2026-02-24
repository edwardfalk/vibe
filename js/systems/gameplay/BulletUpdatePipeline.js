export function updateBullets(context) {
  const { playerBullets, enemyBullets, bulletClass } = context;

  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const bullet = playerBullets[i];
    bullet.update();

    if (bullet.isOffScreen()) {
      bulletClass.release(bullet);
      playerBullets.splice(i, 1);
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const bullet = enemyBullets[i];
    bullet.update();

    if (bullet.isOffScreen()) {
      console.log(
        `➖ Removing enemy bullet (off-screen): ${bullet.owner} at (${Math.round(bullet.x)}, ${Math.round(bullet.y)}) - Remaining: ${enemyBullets.length - 1}`
      );
      bulletClass.release(bullet);
      enemyBullets.splice(i, 1);
    }
  }
}
