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
      bulletClass.release(bullet);
      enemyBullets.splice(i, 1);
    }
  }
}
