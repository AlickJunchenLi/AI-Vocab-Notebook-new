import { approach } from "./liquidField.js";

// The WebGL layer, and the OGL library under it, is only fetched once a
// pointer that can use it is around; a touch screen never downloads it.
let layerModule = null;

function loadLayer() {
  layerModule ??= import("./liquidGlassGL.js");
  return layerModule;
}

/*
 * A small pool of layers, so only the surfaces nearest the pointer pay for
 * WebGL. A surface that drops out of the pool fades out on its own canvas
 * before the canvas is reused; `failed` turns true if WebGL is unavailable or
 * a context is lost, and stays true. The layers' code arrives on first use
 * (or when prewarm() starts warming while the page is idle); `onReady` is
 * called once it has, so a pointer already over the page can be drawn for.
 */
export class LiquidLayerPool {
  constructor(size = 2, onReady = null) {
    this.size = size;
    this.slots = [];
    this.failed = false;
    this.Layer = null;
    this.loading = false;
    this.afterLoad = null;
    this.destroyed = false;
    this.onReady = onReady;
  }

  load() {
    if (this.Layer || this.loading || this.failed) return;
    this.loading = true;
    loadLayer()
      .then(({ LiquidLayer }) => {
        this.Layer = LiquidLayer;
      }, () => {
        this.failed = true;
      })
      .finally(() => {
        this.loading = false;
        if (this.destroyed) return;
        this.afterLoad?.();
        this.afterLoad = null;
        this.onReady?.();
      });
  }

  /*
   * `requests` are ordered most important first: { key, element, width,
   * height, pixelRatio, values }. Returns true while any layer is fading.
   */
  sync(requests, delta, debug = false) {
    if (this.failed) return false;
    if (!this.Layer) {
      this.load();
      return false;
    }
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
  /*
   * Creates and warms the layers ahead of time, one per moment the page is
   * idle (`schedule` asks for one and returns a way to cancel it): setting
   * up a WebGL context and compiling its shaders takes a while, and doing
   * them all at once could stall an animation the user has just started.
   * Returns a function that stops the warming.
   */
  prewarm(schedule = (step) => {
    step();
    return () => {};
  }) {
    let cancel = null;
    let stopped = false;
    const step = () => {
      cancel = null;
      if (stopped || this.destroyed || this.failed) return;
      if (!this.Layer) {
        this.afterLoad = () => {
          if (!stopped) cancel = schedule(step);
        };
        this.load();
        return;
      }
      if (this.slots.length >= this.size) return;
      this.createSlot()?.layer.warm();
      cancel = schedule(step);
    };
    cancel = schedule(step);
    return () => {
      stopped = true;
      cancel?.();
    };
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
      const slot = { layer: new this.Layer(), key: null, fade: 0, request: null };
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

  // Also used when a context is lost; after unmounting, `destroyed` keeps a
  // late arrival of the layer code from drawing anything.
  destroy(final = false) {
    if (final) this.destroyed = true;
    for (const slot of this.slots) slot.layer.destroy();
    this.slots = [];
  }
}
