export function drawSubtleSpaceElementsLayer(p) {
  p.noStroke();

  p.fill(60, 40, 80, 15);
  p.ellipse(p.width * 0.2, p.height * 0.3, 200, 150);

  p.fill(50, 60, 90, 12);
  p.ellipse(p.width * 0.8, p.height * 0.7, 180, 120);

  p.fill(200, 200, 255, 40);
  for (let i = 0; i < 6; i++) {
    const x = (i * p.width) / 6 + p.width / 12;
    const y = p.height * 0.15 + (i % 2) * p.height * 0.1;
    p.ellipse(x, y, 1, 1);
  }
}
