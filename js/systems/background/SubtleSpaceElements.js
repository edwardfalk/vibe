let cachedSubtleElements = null;
let lastWidth = 0;
let lastHeight = 0;

export function drawSubtleSpaceElementsLayer(p) {
  if (
    !cachedSubtleElements ||
    lastWidth !== p.width ||
    lastHeight !== p.height
  ) {
    if (cachedSubtleElements) cachedSubtleElements.remove();
    cachedSubtleElements = p.createGraphics(p.width, p.height);
    lastWidth = p.width;
    lastHeight = p.height;

    cachedSubtleElements.noStroke();

    cachedSubtleElements.fill(60, 40, 80, 15);
    cachedSubtleElements.ellipse(p.width * 0.2, p.height * 0.3, 200, 150);

    cachedSubtleElements.fill(50, 60, 90, 12);
    cachedSubtleElements.ellipse(p.width * 0.8, p.height * 0.7, 180, 120);

    cachedSubtleElements.fill(200, 200, 255, 40);
    for (let i = 0; i < 6; i++) {
      const x = (i * p.width) / 6 + p.width / 12;
      const y = p.height * 0.15 + (i % 2) * p.height * 0.1;
      cachedSubtleElements.ellipse(x, y, 1, 1);
    }
  }

  p.push();
  p.imageMode(p.CORNER);
  p.image(cachedSubtleElements, 0, 0);
  p.pop();
}

export function resetSubtleSpaceElementsCache() {
  if (cachedSubtleElements) {
    cachedSubtleElements.remove();
    cachedSubtleElements = null;
  }
}
