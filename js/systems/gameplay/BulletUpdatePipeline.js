export function updateBullets(context) {
  const { playerBullets, enemyBullets, bulletClass } = context;

  compactBullets(playerBullets, bulletClass);
  compactBullets(enemyBullets, bulletClass);
}

// Single-pass compaction: O(n) instead of O(n²) from repeated splice
function compactBullets(arr, bulletClass) {
  let write = 0;
  for (let read = 0; read < arr.length; read++) {
    const bullet = arr[read];
    bullet.update();

    if (bullet.isOffScreen()) {
      bulletClass.release(bullet);
    } else {
      arr[write++] = bullet;
    }
  }
  arr.length = write;
}
