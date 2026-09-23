import { Mesh, Program, Renderer, Triangle } from "ogl";
import { approach } from "./liquidField.js";
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
 * The rim is a bevel: height rises from 0 at the edge to 1 at `uBevel` inside.
 * The dent is a disc carved out of the same field with a smooth maximum, so
 * near the rim the two merge through a neck. The dent is pressed in with a
 * soft profile, flat at both ends, so it reads as a smooth bowl rather than a
 * cut; subtracting the rim's own share of that profile keeps the dent local.
 * The lamp hangs above the pointer; every pixel works out its own normal and
 * is lit on its own, which is why no highlight can jump between edges.
 */
const FRAGMENT = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform vec2 uSize;
uniform float uRadius;
uniform vec2 uCursor;
uniform vec2 uStretch;
uniform float uAmount;
uniform float uDentRadius;
uniform float uDentDepth;
uniform float uDentSoftness;
uniform float uNeck;
uniform float uBevel;
uniform float uBevelHeight;
uniform float uLightHeight;
uniform float uFalloff;
uniform float uGlow;
uniform float uSpecular;
uniform float uShininess;
uniform float uShade;
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

float smoothMax(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return max(a, b) + h * h * k * 0.25;
}

// Convex bevel: steep at the edge, flattening onto the top of the slab.
float profile(float depth) {
  float x = clamp(depth / uBevel, 0.0, 1.0);
  return 1.0 - pow(1.0 - x, 2.5);
}

// Distance from the dent's centre. A moving dent trails the pointer a little
// and stretches along its direction of travel, the way a drop drags.
float dentDistance(vec2 p, float radius) {
  vec2 q = p - uCursor;
  float stretch = length(uStretch);
  if (stretch > 0.0001) {
    vec2 direction = uStretch / stretch;
    q += direction * stretch * radius * 0.4;
    float along = dot(q, direction);
    q = (q - direction * along) + direction * along / (1.0 + stretch);
  }
  return length(q);
}

// 0 at the dent's floor, rising to 1 at its radius. Every point inside the
// glass is at 1 on its own, so the dent keeps its full depth right up to the
// rim when the neck opens onto it.
float dentProfile(float depth) {
  float x = clamp(depth / uDentSoftness + 1.0, 0.0, 1.0);
  // Smootherstep: flat in both slope and curvature at its ends, so the wall
  // meets the floor and the lip without a visible crease.
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

// The bevel's height and the dent's (negative) height, in pixels. The surface
// is their sum; keeping them apart lets the dent be shaded on its own.
vec2 heightAt(vec2 p, float radius) {
  float rim = sdRoundedRect(p);
  float carved = smoothMax(rim, radius - dentDistance(p, radius), uNeck);
  // Zero wherever the dent does not reach, so the rest of the rim is untouched.
  float pressed = dentProfile(-rim) - dentProfile(-carved);
  return vec2(profile(-rim), -pressed * uDentDepth * uAmount) * uBevelHeight;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y) / uResolution * uSize;
  float rim = sdRoundedRect(p);
  float inside = clamp(0.5 - rim, 0.0, 1.0);
  float radius = uDentRadius * clamp(uAmount, 0.0, 1.25);
  float planar = length(p - uCursor);

  if (uDebug > 0.5) {
    vec2 layers = heightAt(p, radius) / uBevelHeight;
    gl_FragColor = vec4(vec3(clamp(layers.x + layers.y, 0.0, 1.0)), 1.0) * inside;
    return;
  }

  // Flat glass away from both the rim and the dent has nothing to light.
  float stretch = length(uStretch);
  float dentReach = (radius + uNeck) * (1.0 + stretch) + radius * stretch + 2.0;
  if (inside <= 0.0 || (-rim > uBevel + 2.0 && planar > dentReach)) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec2 centre = heightAt(p, radius);
  vec2 left = heightAt(p - vec2(1.0, 0.0), radius);
  vec2 right = heightAt(p + vec2(1.0, 0.0), radius);
  vec2 up = heightAt(p - vec2(0.0, 1.0), radius);
  vec2 down = heightAt(p + vec2(0.0, 1.0), radius);
  vec2 slopeX = (right - left) * 0.5;
  vec2 slopeY = (down - up) * 0.5;
  vec2 rimGradient = vec2(slopeX.x, slopeY.x);
  vec2 dentGradient = vec2(slopeX.y, slopeY.y);
  vec2 gradient = rimGradient + dentGradient;
  vec2 laplacian = left + right + up + down - 4.0 * centre;
  float curvature = laplacian.x + laplacian.y;
  vec3 normal = normalize(vec3(-gradient, 1.0));

  vec3 surfacePoint = vec3(p, centre.x + centre.y);
  vec3 toLight = normalize(vec3(uCursor, uLightHeight) - surfacePoint);
  vec3 halfVector = normalize(toLight + vec3(0.0, 0.0, 1.0));
  // Gaussian, halving at uFalloff, so rims far from the pointer stay clean.
  float attenuation = exp2(-(planar * planar) / (uFalloff * uFalloff));

  // Light scattered inside the bevel, whichever way it faces, so the rim
  // nearest the pointer brightens even when it tilts away from the lamp.
  float rimGlow = smoothstep(0.03, 1.2, length(rimGradient)) * uGlow;
  // Crisp reflection where a slope faces the lamp: the neck, and the rim
  // itself when the pointer approaches from outside.
  float specular = pow(max(dot(normal, halfVector), 0.0), uShininess) *
    smoothstep(0.01, 0.25, length(gradient)) * uSpecular;
  // Glass refracts: convex curves (the rim, the dent's lip) gather light into
  // bright bands, concave ones (the dent's floor) spread it thin.
  float lens = clamp(-curvature * 6.0, -1.0, 1.0) * uCaustic;
  // The dent is also shaded by the page's key light, which comes from above
  // like the glass's resting top light: its upper wall falls into shade and
  // its lower wall catches light, which is what makes it read as pressed in.
  vec3 keyLight = normalize(vec3(-0.25, -1.0, 1.1));
  float keyShading =
    (dot(normalize(vec3(-dentGradient, 1.0)), keyLight) - keyLight.z) * 4.0 * uShade;

  float light = (rimGlow + specular + max(lens, 0.0)) * attenuation + max(keyShading, 0.0);
  float dark = max(-lens, 0.0) * 0.6 * attenuation + max(-keyShading, 0.0);
  float lightAlpha = clamp(light, 0.0, 1.0) * inside;
  float darkAlpha = clamp(dark, 0.0, 1.0) * inside * (1.0 - lightAlpha);

  // Premultiplied: the light composited over the shade.
  vec3 colour = uLightColor * lightAlpha + uShadeColor * darkAlpha;
  gl_FragColor = vec4(colour, lightAlpha + darkAlpha) * uOpacity;
}
`;

// Uniform name -> key in the values object a caller passes to render().
const UNIFORM_KEYS = {
  uRadius: "radius",
  uCursor: "cursor",
  uStretch: "stretch",
  uAmount: "amount",
  uDentRadius: "dentRadius",
  uDentDepth: "dentDepth",
  uDentSoftness: "dentSoftness",
  uNeck: "neck",
  uBevel: "bevel",
  uBevelHeight: "bevelHeight",
  uLightHeight: "lightHeight",
  uFalloff: "falloff",
  uGlow: "glow",
  uSpecular: "specular",
  uShininess: "shininess",
  uShade: "shade",
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
    uStretch: { value: [0, 0] },
    uAmount: { value: 0 },
    uDentRadius: { value: 0 },
    uDentDepth: { value: 0 },
    uDentSoftness: { value: 1 },
    uNeck: { value: 1 },
    uBevel: { value: 1 },
    uBevelHeight: { value: 1 },
    uLightHeight: { value: 1 },
    uFalloff: { value: 1 },
    uGlow: { value: 0 },
    uSpecular: { value: 0 },
    uShininess: { value: 1 },
    uShade: { value: 0 },
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

  claimSlot(wanted) {
    const idle = this.slots.find((slot) => slot.key === null);
    if (idle) return idle;
    if (this.slots.length < this.size) {
      try {
        const slot = { layer: new LiquidLayer(), key: null, fade: 0, request: null };
        this.slots.push(slot);
        return slot;
      } catch {
        this.failed = true;
        return null;
      }
    }
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
