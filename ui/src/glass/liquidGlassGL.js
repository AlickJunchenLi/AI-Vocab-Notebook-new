import { Mesh, Program, Renderer, Triangle } from "ogl";
import { approach, SIDE_COUNT } from "./liquidField.js";
import "./liquidLayer.css";

const VERTEX = /* glsl */ `
attribute vec2 position;

void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/*
 * Lights the glass as a height field. All lengths are CSS pixels in the
 * surface's padding box, y pointing down, z pointing out of the screen.
 *
 * The rim is a bevel: height rises from 0 at the edge to 1 at uBevel inside.
 * As the pointer nears an edge, the rim there swells (its bevel grows wider,
 * and its highlight with it) and sends a liquid trace towards the pointer:
 * light gathered in the glass, flared where it clings to the rim like a
 * meniscus and drawn out thin to a rounded tip just short of the pointer. It
 * is mostly light, with only a soft, faint shade outside its edge, like a
 * glass droplet on a surface, so it never reads as a drawn outline. The
 * shapes are laid out once per frame on the CPU (computeTraces in
 * liquidField.js), one per side, so every pixel draws the same ones. Nothing
 * is drawn around the pointer itself.
 *
 * The rim nearest the pointer also carries a bright band with a thin darker
 * hairline outside it, which is what lets a white highlight read on pale
 * glass.
 */
const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform vec2 uSize;
uniform float uRadius;
uniform vec2 uCursor;
// The single trace: where it leaves the rim (xy) and its direction (zw), then
// its mouth radius, tip radius, spine length and strength.
uniform vec4 uTraceFrame;
uniform vec4 uTraceShape;
// Per side: the rim point nearest the pointer, and how much the rim swells
// there.
uniform vec2 uSwellPoint[${SIDE_COUNT}];
uniform float uTraceSwell[${SIDE_COUNT}];
uniform float uTraceWall;
uniform float uTraceEdge;
uniform float uTraceShade;
uniform float uTipGap;
uniform float uSwellWidth;
uniform float uReach;
uniform float uBevel;
uniform float uBevelHeight;
uniform float uLightHeight;
uniform float uFalloff;
uniform float uGlow;
uniform float uEdgeContrast;
uniform float uSpecular;
uniform float uShininess;
uniform float uCaustic;
uniform vec3 uLightColor;
uniform vec3 uShadeColor;
uniform float uOpacity;
uniform float uDebug;

float sdRoundedRect(vec2 p) {
  vec2 halfSize = uSize * 0.5;
  float radius = min(uRadius, min(halfSize.x, halfSize.y));
  vec2 q = abs(p - halfSize) - halfSize + radius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
}

// Convex bevel: steep at the edge, flattening onto the top of the slab.
float profile(float depth, float width) {
  float x = clamp(depth / width, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 2.5);
}

float smootherstep01(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

float band(float x, float centre, float width) {
  float t = (x - centre) / width;
  return exp2(-t * t);
}

// How much the rim swells at p: most on each side's stretch nearest the
// pointer.
float swellAt(vec2 p) {
  float swell = 0.0;
  for (int i = 0; i < ${SIDE_COUNT}; i++) {
    float amount = uTraceSwell[i];
    if (amount <= 0.0) continue;
    vec2 offset = p - uSwellPoint[i];
    swell = max(swell, amount * exp2(-dot(offset, offset) / (uSwellWidth * uSwellWidth)));
  }
  return swell;
}

// Approximate distance to a trace laid along the local y axis from the rim
// (y = 0). Its sides curve in like a meniscus: flared where it clings to the
// rim, drawn out thin towards a rounded tip.
float sdTrace(vec2 local, vec4 shape) {
  float mouth = shape.x;
  float tip = shape.y;
  float traceLength = shape.z + tip;
  float x = abs(local.x);
  float capCentre = traceLength - tip;
  if (local.y > capCentre) return length(vec2(x, local.y - capCentre)) - tip;
  // Narrows to exactly the tip's width, running parallel as it meets the cap,
  // so the side and the rounded tip join without a step.
  float t = clamp(local.y / max(capCentre, 0.001), 0.0, 1.0);
  return x - (tip + (mouth - tip) * (1.0 - t) * (1.0 - t));
}

// Half-width of a trace at a point along it, matching sdTrace.
float traceHalfWidth(vec2 local, vec4 shape) {
  float capCentre = shape.z;
  if (local.y > capCentre) return shape.y;
  float t = clamp(local.y / max(capCentre, 0.001), 0.0, 1.0);
  return shape.y + (shape.x - shape.y) * (1.0 - t) * (1.0 - t);
}

// The light (x) and shade (y) the trace puts at p. The trace is light
// gathered in the glass, flowing from the rim towards the pointer: a soft
// body, brightest down its middle and where it leaves the rim, and optionally
// a fine bright line just inside its edge, the way the glass's own rim catches
// light, with a soft, faint shade outside it, the way a droplet sits on a
// surface.
vec2 traceAt(vec2 p) {
  vec4 shape = uTraceShape;
  if (shape.w <= 0.0) return vec2(0.0);
  vec4 frame = uTraceFrame;
  vec2 offset = p - frame.xy;
  vec2 local = vec2(dot(offset, vec2(-frame.w, frame.z)), dot(offset, frame.zw));
  float distance = sdTrace(local, shape);
  float soft = uTraceWall * 0.5;
  float body = smootherstep01((soft - distance) / (traceHalfWidth(local, shape) + soft));
  float along = clamp(local.y / (shape.z + shape.y), 0.0, 1.0);
  float taper = mix(1.0, 0.45, along);
  float edge = band(distance, -1.5, 1.3) * uTraceEdge;
  float shade = band(distance, 4.0, 5.0) * uTraceShade;
  return vec2(body + edge, shade) * taper * shape.w;
}

// The bevel's height in pixels. Near the pointer the rim swells: its bevel
// grows wider.
float heightAt(vec2 p) {
  return profile(-sdRoundedRect(p), uBevel * (1.0 + swellAt(p))) * uBevelHeight;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution * uSize;
  float rim = sdRoundedRect(p);
  float depth = -rim;
  float inside = clamp(0.5 - rim, 0.0, 1.0);

  // Debug view: the bevel's height, with the traces' light on top in red.
  if (uDebug > 0.5) {
    float height = heightAt(p) / uBevelHeight;
    gl_FragColor = vec4(max(vec3(height), vec3(traceAt(p).x, 0.0, 0.0)), 1.0) * inside;
    return;
  }

  // Deeper than the swollen bevel and the traces can reach, the glass is flat.
  if (inside <= 0.0 || depth > max(uBevel * 2.6, uReach) + 2.0) {
    gl_FragColor = vec4(0.0);
    return;
  }

  float centre = heightAt(p);
  float left = heightAt(p - vec2(1.0, 0.0));
  float right = heightAt(p + vec2(1.0, 0.0));
  float up = heightAt(p - vec2(0.0, 1.0));
  float down = heightAt(p + vec2(0.0, 1.0));
  vec2 gradient = vec2(right - left, down - up) * 0.5;
  float curvature = left + right + up + down - 4.0 * centre;
  vec3 normal = normalize(vec3(-gradient, 1.0));

  vec3 surfacePoint = vec3(p, centre);
  vec3 toLight = normalize(vec3(uCursor, uLightHeight) - surfacePoint);
  vec3 halfVector = normalize(toLight + vec3(0.0, 0.0, 1.0));
  // Gaussian, halving at uFalloff, so rims far from the pointer stay clean.
  float planar = length(p - uCursor);
  float attenuation = exp2(-(planar * planar) / (uFalloff * uFalloff));

  // The rim highlight: a bright band just inside the edge, with a thin darker
  // hairline right at the edge so the white reads against pale glass. Where
  // the rim swells, the band widens and brightens with it.
  float swell = swellAt(p);
  float bevel = uBevel * (1.0 + swell);
  float rimLight = band(depth, bevel * 0.3, bevel * 0.22) * uGlow * (0.6 + swell);
  float hairline = band(depth, 0.8, 0.9) * uEdgeContrast * (0.6 + swell);
  // Crisp reflection where a slope faces the lamp, kept off the glass right
  // under the pointer so nothing lights up at the pointer itself.
  float specular = pow(max(dot(normal, halfVector), 0.0), uShininess) *
    smoothstep(0.01, 0.25, length(gradient)) * uSpecular *
    smoothstep(uTipGap, uTipGap * 3.0, planar);
  // Glass refracts: the rim's convex curve gathers light into a bright band,
  // and the concave step at the very edge spreads it thin.
  float lens = clamp(-curvature * 6.0, -1.0, 1.0) * uCaustic;

  vec2 trace = traceAt(p);
  // The trace rises out of the rim's bevel rather than over the edge itself,
  // so the edge keeps its line where the trace leaves it.
  float traceLight = trace.x * smoothstep(1.0, uBevel * 0.7, depth);
  float light = (rimLight + specular + max(lens, 0.0)) * attenuation + traceLight;
  float dark = (hairline + max(-lens, 0.0) * 0.6) * attenuation + trace.y;
  float lightAlpha = clamp(light, 0.0, 1.0) * inside;
  float darkAlpha = clamp(dark, 0.0, 1.0) * inside;

  // Premultiplied, with the shade over the light: the edge's darker line is
  // what makes the glass's rim read, so no light is allowed to wash it out.
  vec3 colour = uShadeColor * darkAlpha + uLightColor * lightAlpha * (1.0 - darkAlpha);
  gl_FragColor = vec4(colour, darkAlpha + lightAlpha * (1.0 - darkAlpha)) * uOpacity;
}
`;

// Uniform name -> key in the values object a caller passes to render().
const UNIFORM_KEYS = {
  uRadius: "radius",
  uCursor: "cursor",
  uTraceFrame: "traceFrame",
  uTraceShape: "traceShape",
  uSwellPoint: "swellPoints",
  uTraceSwell: "traceSwells",
  uTraceWall: "traceWall",
  uTraceEdge: "traceEdge",
  uTraceShade: "traceShade",
  uTipGap: "tipGap",
  uSwellWidth: "swellWidth",
  uReach: "reach",
  uBevel: "bevel",
  uBevelHeight: "bevelHeight",
  uLightHeight: "lightHeight",
  uFalloff: "falloff",
  uGlow: "glow",
  uEdgeContrast: "edgeContrast",
  uSpecular: "specular",
  uShininess: "shininess",
  uCaustic: "caustic",
  uLightColor: "lightColor",
  uShadeColor: "shadeColor",
};

function createUniforms() {
  return {
    uResolution: { value: [1, 1] },
    uSize: { value: [1, 1] },
    uRadius: { value: 0 },
    uCursor: { value: [0, 0] },
    uTraceFrame: { value: [0, 0, 0, 1] },
    uTraceShape: { value: [0, 0, 0, 0] },
    uSwellPoint: { value: Array.from({ length: SIDE_COUNT }, () => [0, 0]) },
    uTraceSwell: { value: new Array(SIDE_COUNT).fill(0) },
    uTraceWall: { value: 1 },
    uTraceEdge: { value: 0 },
    uTraceShade: { value: 0 },
    uTipGap: { value: 0 },
    uSwellWidth: { value: 1 },
    uReach: { value: 1 },
    uBevel: { value: 1 },
    uBevelHeight: { value: 1 },
    uLightHeight: { value: 1 },
    uFalloff: { value: 1 },
    uGlow: { value: 0 },
    uEdgeContrast: { value: 0 },
    uSpecular: { value: 0 },
    uShininess: { value: 1 },
    uCaustic: { value: 0 },
    uLightColor: { value: [1, 1, 1] },
    uShadeColor: { value: [0, 0, 0] },
    uOpacity: { value: 0 },
    uDebug: { value: 0 },
  };
}

/*
 * One WebGL canvas that can be moved between surfaces. Throws if WebGL is not
 * available, so callers can fall back to the CSS light layers.
 */
export class LiquidLayer {
  constructor() {
    const canvas = document.createElement("canvas");
    canvas.className = "liquid-glass-layer";
    canvas.setAttribute("aria-hidden", "true");
    this.canvas = canvas;
    this.renderer = new Renderer({
      canvas,
      alpha: true,
      premultipliedAlpha: true,
      depth: false,
      antialias: false,
      powerPreference: "low-power",
    });
    const { gl } = this.renderer;
    gl.clearColor(0, 0, 0, 0);
    this.uniforms = createUniforms();
    this.mesh = new Mesh(gl, {
      geometry: new Triangle(gl),
      program: new Program(gl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms: this.uniforms,
        depthTest: false,
        depthWrite: false,
      }),
    });
    this.width = 0;
    this.height = 0;
    this.pixelRatio = 0;
    this.lost = false;
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.lost = true;
    });
  }

  attach(element) {
    if (this.canvas.parentNode !== element) element.prepend(this.canvas);
  }

  detach() {
    this.canvas.remove();
  }

  resize(width, height, pixelRatio) {
    if (width === this.width && height === this.height && pixelRatio === this.pixelRatio) return;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.renderer.dpr = pixelRatio;
    this.renderer.setSize(width, height);
  }

  render(values, fade, debug = false) {
    if (this.lost) return;
    const uniforms = this.uniforms;
    uniforms.uResolution.value = [this.canvas.width, this.canvas.height];
    uniforms.uSize.value = [this.width, this.height];
    for (const [uniform, key] of Object.entries(UNIFORM_KEYS)) {
      uniforms[uniform].value = values[key];
    }
    uniforms.uOpacity.value = debug ? fade : values.opacity * fade;
    uniforms.uDebug.value = debug ? 1 : 0;
    this.renderer.render({ scene: this.mesh });
  }

  // Draws one invisible frame, so the shader is compiled and uploaded before
  // the pointer first reaches a surface instead of stalling that frame.
  warm() {
    this.resize(1, 1, 1);
    this.renderer.render({ scene: this.mesh });
  }

  destroy() {
    this.renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
    this.canvas.remove();
  }
}

/*
 * A small pool of layers, so only the surfaces nearest the pointer pay for
 * WebGL. A surface that drops out of the pool fades out on its own canvas
 * before the canvas is reused; `failed` turns true if WebGL is unavailable or
 * a context is lost, and stays true.
 */
export class LiquidLayerPool {
  constructor(size = 2) {
    this.size = size;
    this.slots = [];
    this.failed = false;
  }

  /*
   * `requests` are ordered most important first: { key, element, width,
   * height, pixelRatio, values }. Returns true while any layer is fading.
   */
  sync(requests, delta, debug = false) {
    if (this.failed) return false;
    const wanted = new Map();
    for (const request of requests) {
      if (wanted.size >= this.size) break;
      wanted.set(request.key, request);
    }

    for (const key of wanted.keys()) {
      if (this.slots.some((slot) => slot.key === key)) continue;
      const slot = this.claimSlot(wanted);
      if (!slot) return false;
      slot.key = key;
      slot.fade = 0;
    }

    let fading = false;
    for (const slot of this.slots) {
      if (slot.key === null) continue;
      const request = wanted.get(slot.key);
      // A surface leaving the pool keeps drawing its last frame while it fades.
      if (request) slot.request = request;
      const target = request ? 1 : 0;
      slot.fade = approach(slot.fade, target, 10, delta);
      if (slot.fade !== target) fading = true;
      if (slot.fade === 0 && !request) {
        slot.layer.detach();
        slot.key = null;
        slot.request = null;
        continue;
      }
      const { element, width, height, pixelRatio, values } = slot.request;
      slot.layer.attach(element);
      slot.layer.resize(width, height, pixelRatio);
      slot.layer.render(values, slot.fade, debug);
      if (slot.layer.lost) this.failed = true;
    }
    if (this.failed) this.destroy();
    return fading;
  }

  // Creates and warms every layer ahead of time; call it when the page is idle.
  prewarm() {
    while (!this.failed && this.slots.length < this.size) this.createSlot()?.layer.warm();
  }

  // Takes every layer off its surface at once, without fading.
  hide() {
    for (const slot of this.slots) {
      slot.layer.detach();
      slot.key = null;
      slot.request = null;
      slot.fade = 0;
    }
  }

  createSlot() {
    try {
      const slot = { layer: new LiquidLayer(), key: null, fade: 0, request: null };
      this.slots.push(slot);
      return slot;
    } catch {
      this.failed = true;
      return null;
    }
  }

  claimSlot(wanted) {
    const idle = this.slots.find((slot) => slot.key === null);
    if (idle) return idle;
    if (this.slots.length < this.size) return this.createSlot();
    // Every layer is busy, so at least one is fading out: take the faintest.
    let victim = null;
    for (const slot of this.slots) {
      if (!wanted.has(slot.key) && (!victim || slot.fade < victim.fade)) victim = slot;
    }
    return victim;
  }

  destroy() {
    for (const slot of this.slots) slot.layer.destroy();
    this.slots = [];
  }
}
