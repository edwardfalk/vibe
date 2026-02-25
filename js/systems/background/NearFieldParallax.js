export function drawCloseDebrisLayer(debris, p) {
  p.stroke(255, 0, 200, 150); // Hot magenta
  p.strokeWeight(2);
  p.noFill();
  p.drawingContext.shadowBlur = 10;
  p.drawingContext.shadowColor = '#FF00C8';

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
  p.drawingContext.shadowBlur = 0;
}

export function drawForegroundSparksLayer(sparks, p) {
  p.noFill();
  p.strokeWeight(2);
  p.drawingContext.shadowBlur = 15;
  p.drawingContext.shadowColor = '#00F3FF';
  for (const spark of sparks) {
    const flicker = p.sin(p.frameCount * spark.flickerSpeed) * 0.5 + 0.5;
    const alpha = spark.alpha * 255 * flicker;
    p.stroke(0, 243, 255, alpha); // Cyan motion blur

    const length = spark.size * 5; // Motion blur length
    p.line(spark.x, spark.y, spark.x - length * 0.8, spark.y + length * 0.6);
  }
  p.drawingContext.shadowBlur = 0;
}
