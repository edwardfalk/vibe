export function drawCloseDebrisLayer(debris, p) {
  p.stroke(100, 100, 100, 150);
  p.strokeWeight(1);
  p.noFill();

  for (const piece of debris) {
    p.push();
    p.translate(piece.x, piece.y);
    p.rotate(piece.rotation);
    piece.rotation += piece.rotationSpeed;

    switch (piece.shape) {
      case 'triangle':
        p.triangle(
          -piece.size / 2,
          piece.size / 2,
          piece.size / 2,
          piece.size / 2,
          0,
          -piece.size / 2
        );
        break;
      case 'square':
        p.rect(-piece.size / 2, -piece.size / 2, piece.size, piece.size);
        break;
      case 'diamond':
        p.quad(
          0,
          -piece.size / 2,
          piece.size / 2,
          0,
          0,
          piece.size / 2,
          -piece.size / 2,
          0
        );
        break;
    }
    p.pop();
  }
}

export function drawForegroundSparksLayer(sparks, p) {
  p.noStroke();
  for (const spark of sparks) {
    const flicker = p.sin(p.frameCount * spark.flickerSpeed) * 0.5 + 0.5;
    p.fill(255, 255, 255, spark.alpha * flicker);
    p.ellipse(spark.x, spark.y, spark.size, spark.size);
  }
}
