import { clamp } from "../glass/roundedRectField.js";

/*
 * The colourful content the selector moves over.
 *
 * It is a canvas rather than CSS gradients for two reasons: straight grid lines
 * make refraction obvious in a way soft gradients never do, and a canvas can be
 * read back cheaply for colour infusion (step 4). A single downscaled snapshot
 * is kept so per-frame sampling is an array lookup instead of a GPU readback.
 */

const SAMPLE_WIDTH = 128;
const SAMPLE_HEIGHT = 128;

const BLOBS = [
  { x: 0.14, y: 0.2, r: 0.42, colour: [99, 102, 241] },
  { x: 0.78, y: 0.14, r: 0.38, colour: [236, 72, 153] },
  { x: 0.9, y: 0.68, r: 0.44, colour: [251, 146, 60] },
  { x: 0.32, y: 0.84, r: 0.4, colour: [16, 185, 129] },
  { x: 0.56, y: 0.46, r: 0.3, colour: [56, 189, 248] },
  { x: 0.08, y: 0.62, r: 0.26, colour: [168, 85, 247] },
  { x: 0.66, y: 0.9, r: 0.24, colour: [250, 204, 21] },
];

const SHAPES = [
  { x: 0.2, y: 0.34, w: 0.13, h: 0.13, colour: "rgba(255,255,255,0.9)", rotate: 0.2 },
  { x: 0.62, y: 0.24, w: 0.1, h: 0.2, colour: "rgba(12,10,42,0.55)", rotate: -0.15 },
  { x: 0.44, y: 0.7, w: 0.18, h: 0.09, colour: "rgba(255,255,255,0.75)", rotate: 0.08 },
  { x: 0.84, y: 0.44, w: 0.09, h: 0.09, colour: "rgba(12,10,42,0.45)", rotate: 0.5 },
];

function drawBlobs(ctx, width, height) {
  const diagonal = Math.hypot(width, height);

  ctx.globalCompositeOperation = "lighter";

  for (const blob of BLOBS) {
    const x = blob.x * width;
    const y = blob.y * height;
    const radius = blob.r * diagonal * 0.62;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const [r, g, b] = blob.colour;

    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
    gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, 0.42)`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.globalCompositeOperation = "source-over";
}

/* Straight lines are the readout: any bend in them is real displacement. */
function drawGrid(ctx, width, height) {
  const spacing = Math.max(28, Math.round(Math.min(width, height) / 18));

  ctx.strokeStyle = "rgba(255, 255, 255, 0.26)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = spacing; x < width; x += spacing) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }

  for (let y = spacing; y < height; y += spacing) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }

  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let x = spacing * 4; x < width; x += spacing * 4) {
    ctx.moveTo(Math.round(x) + 0.5, 0);
    ctx.lineTo(Math.round(x) + 0.5, height);
  }

  for (let y = spacing * 4; y < height; y += spacing * 4) {
    ctx.moveTo(0, Math.round(y) + 0.5);
    ctx.lineTo(width, Math.round(y) + 0.5);
  }

  ctx.stroke();
}

function drawShapes(ctx, width, height) {
  for (const shape of SHAPES) {
    ctx.save();
    ctx.translate(shape.x * width, shape.y * height);
    ctx.rotate(shape.rotate);
    ctx.fillStyle = shape.colour;
    ctx.fillRect(
      (-shape.w * width) / 2,
      (-shape.h * height) / 2,
      shape.w * width,
      shape.h * height,
    );
    ctx.restore();
  }
}

export function createColourField(canvas) {
  const sampleCanvas = document.createElement("canvas");
  sampleCanvas.width = SAMPLE_WIDTH;
  sampleCanvas.height = SAMPLE_HEIGHT;

  const sampleContext = sampleCanvas.getContext("2d", { willReadFrequently: true });
  let samplePixels = null;
  let cssWidth = 1;
  let cssHeight = 1;

  function draw(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));

    cssWidth = Math.max(1, width);
    cssHeight = Math.max(1, height);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const base = ctx.createLinearGradient(0, 0, width, height);
    base.addColorStop(0, "#0b1030");
    base.addColorStop(0.5, "#161046");
    base.addColorStop(1, "#0a1b3a");
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, width, height);

    drawBlobs(ctx, width, height);
    drawShapes(ctx, width, height);
    drawGrid(ctx, width, height);

    sampleContext.clearRect(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    sampleContext.drawImage(canvas, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
    samplePixels = sampleContext.getImageData(
      0,
      0,
      SAMPLE_WIDTH,
      SAMPLE_HEIGHT,
    ).data;
  }

  /* Average the backdrop in a small disc around a stage-local point. */
  function sample(x, y, radius = 40) {
    if (!samplePixels) {
      return null;
    }

    const scaleX = SAMPLE_WIDTH / cssWidth;
    const scaleY = SAMPLE_HEIGHT / cssHeight;
    const centreX = x * scaleX;
    const centreY = y * scaleY;
    const spreadX = Math.max(1, radius * scaleX);
    const spreadY = Math.max(1, radius * scaleY);
    const offsets = [
      [0, 0],
      [-spreadX, 0],
      [spreadX, 0],
      [0, -spreadY],
      [0, spreadY],
      [-spreadX * 0.7, -spreadY * 0.7],
      [spreadX * 0.7, spreadY * 0.7],
    ];

    let r = 0;
    let g = 0;
    let b = 0;

    for (const [offsetX, offsetY] of offsets) {
      const sampleX = Math.round(
        clamp(centreX + offsetX, 0, SAMPLE_WIDTH - 1),
      );
      const sampleY = Math.round(
        clamp(centreY + offsetY, 0, SAMPLE_HEIGHT - 1),
      );
      const index = (sampleY * SAMPLE_WIDTH + sampleX) * 4;

      r += samplePixels[index];
      g += samplePixels[index + 1];
      b += samplePixels[index + 2];
    }

    return {
      r: r / offsets.length,
      g: g / offsets.length,
      b: b / offsets.length,
    };
  }

  return { draw, sample };
}
