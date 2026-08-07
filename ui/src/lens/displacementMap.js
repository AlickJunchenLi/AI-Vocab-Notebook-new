import {
  computeSdfGradient,
  saturate,
  sdRoundedRect,
} from "../glass/roundedRectField.js";

/*
 * Step 3 - backdrop displacement.
 *
 * feDisplacementMap resamples its input:
 *
 *   P'(x, y) <- P( x + scale * (R(x,y) - 0.5), y + scale * (G(x,y) - 0.5) )
 *
 * so 128 in a channel means "no shift". This builds the map that makes the
 * resampling read as curved glass:
 *
 *   direction - the outward normal of the rounded rectangle, taken from the
 *               gradient of the signed distance field. Corners therefore blend
 *               continuously instead of snapping to a nearest side.
 *   magnitude - 1 at the border, falling to 0 over `edge` pixels, shaped by
 *               `bulge`. Higher bulge concentrates the bend in a thinner band,
 *               which reads as a sharper bevel.
 *
 * Displacing along +normal samples from further out, which is what pulls the
 * surroundings inward and compresses them against the rim.
 *
 * The map is padded so the filter region can extend past the element box:
 * without that, outward samples near the rim would fall outside the region and
 * come back empty, leaving a dark fringe.
 */

const MAP_CACHE = new Map();
const MAX_CACHE_ENTRIES = 24;

function buildMap({ width, height, radius, edge, bulge, pad }) {
  const mapWidth = Math.max(1, Math.round(width + pad * 2));
  const mapHeight = Math.max(1, Math.round(height + pad * 2));
  const canvas = document.createElement("canvas");
  canvas.width = mapWidth;
  canvas.height = mapHeight;

  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(mapWidth, mapHeight);
  const pixels = image.data;
  const safeEdge = Math.max(1, edge);

  for (let y = 0; y < mapHeight; y += 1) {
    // Shape-local coordinates, origin at the centre of the rounded rectangle.
    const localY = y + 0.5 - pad - height * 0.5;

    for (let x = 0; x < mapWidth; x += 1) {
      const localX = x + 0.5 - pad - width * 0.5;
      const index = (y * mapWidth + x) * 4;
      const distance = sdRoundedRect(localX, localY, width, height, radius);

      if (distance >= 0) {
        // Outside the lens: identity, so the padding contributes no shift.
        pixels[index] = 128;
        pixels[index + 1] = 128;
        pixels[index + 2] = 0;
        pixels[index + 3] = 255;
        continue;
      }

      const depth = -distance;
      const falloff = Math.pow(saturate(1 - depth / safeEdge), bulge);

      if (falloff <= 0) {
        pixels[index] = 128;
        pixels[index + 1] = 128;
        pixels[index + 2] = 0;
        pixels[index + 3] = 255;
        continue;
      }

      const { nx, ny } = computeSdfGradient(
        localX,
        localY,
        width,
        height,
        radius,
      );

      pixels[index] = Math.round(128 + 127 * nx * falloff);
      pixels[index + 1] = Math.round(128 + 127 * ny * falloff);
      // Blue keeps the raw profile around; useful for masking and for debugging.
      pixels[index + 2] = Math.round(255 * falloff);
      pixels[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  return canvas.toDataURL("image/png");
}

export function createDisplacementMap(options) {
  const key = [
    Math.round(options.width),
    Math.round(options.height),
    Math.round(options.radius),
    Math.round(options.edge),
    options.bulge.toFixed(2),
    Math.round(options.pad),
  ].join(":");

  const cached = MAP_CACHE.get(key);

  if (cached) {
    return cached;
  }

  const map = buildMap(options);

  if (MAP_CACHE.size >= MAX_CACHE_ENTRIES) {
    MAP_CACHE.delete(MAP_CACHE.keys().next().value);
  }

  MAP_CACHE.set(key, map);

  return map;
}
