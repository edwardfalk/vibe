/**
 * Sprites for the enemy renderers: the parts of a figure that never change
 * shape, drawn once into offscreen graphics. One cache per p5 instance and
 * per parts table (the grunt's, the tank's), built on the first draw. A new
 * drawn size rebuilds that table's sprites and removes the old ones.
 *
 * A parts table maps a name to [[x0, y0, x1, y1], draw(g, s)]: the part's
 * bounds in units of s around the figure's centre, and how to draw it. A
 * part's draw reads only s and frozen constants; anything ?tune can change
 * is drawn live.
 */
const SPRITE_SCALE = 4; // sprite px per drawn px, so a zoomed enemy stays crisp
const caches = new WeakMap(); // p5 instance → Map(parts table → { s, parts })

export function spriteParts(p, table, s) {
  let byTable = caches.get(p);
  if (!byTable) caches.set(p, (byTable = new Map()));
  const cached = byTable.get(table);
  if (cached?.s === s) return cached.parts;
  for (const part of Object.values(cached?.parts ?? {})) part.g.remove();
  const parts = {};
  for (const [name, [[x0, y0, x1, y1], draw]] of Object.entries(table)) {
    const w = (x1 - x0) * s;
    const h = (y1 - y0) * s;
    const g = p.createGraphics(
      Math.ceil(w * SPRITE_SCALE),
      Math.ceil(h * SPRITE_SCALE)
    );
    g.pixelDensity(1);
    g.noStroke();
    g.scale(SPRITE_SCALE);
    g.translate(-x0 * s, -y0 * s);
    draw(g, s);
    parts[name] = { g, x: x0 * s, y: y0 * s, w, h };
  }
  byTable.set(table, { s, parts });
  return parts;
}

export const stamp = (p, part) =>
  p.image(part.g, part.x, part.y, part.w, part.h);
