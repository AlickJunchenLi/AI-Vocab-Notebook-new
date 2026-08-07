import { useEffect, useRef } from "react";
import { clamp, lerp, saturate } from "../glass/roundedRectField.js";

/*
 * Step 1 - selector movement.
 *
 * The lens is driven by a damped spring integrated at a fixed timestep, not by
 * a CSS transition. A spring is what gives the selector weight: it lags behind
 * the pointer, overshoots slightly on release, and settles. Every derived value
 * the later layers need (speed, heading, squash, press) falls out of the same
 * integration, so lighting and refraction stay in sync with the motion for
 * free.
 *
 * Nothing here triggers a React render. The loop writes CSS custom properties
 * straight onto the element, which keeps the whole effect off the commit path.
 */

const FIXED_STEP = 1 / 120;
const MAX_FRAME_TIME = 0.05;

const SPRING = {
  // Underdamped on purpose: critical damping for mass 1 would be 2*sqrt(k).
  stiffness: 190,
  damping: 21,
  mass: 1,
};

// Speed at which squash/stretch and motion-driven lighting reach full strength.
const SPEED_REFERENCE = 1400;
const MAX_STRETCH = 0.07;
const STATE_LERP = 0.16;
const REST_EPSILON = 0.02;

function createState(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    targetX: x,
    targetY: y,
    // Interaction weights, smoothed towards 0/1 rather than snapping.
    hover: 0,
    hoverTarget: 0,
    press: 0,
    pressTarget: 0,
    dragging: false,
    grabX: 0,
    grabY: 0,
    speed: 0,
    headingX: 0,
    headingY: 0,
    stretch: 0,
  };
}

function writeVariable(cache, element, name, value) {
  if (cache.get(name) === value) {
    return;
  }

  cache.set(name, value);
  element.style.setProperty(name, value);
}

export function useLensMotion({
  stageRef,
  lensRef,
  width,
  height,
  follow = false,
  onFrame,
}) {
  const stateRef = useRef(createState(0, 0));
  const sizeRef = useRef({ width, height });
  const followRef = useRef(follow);
  const onFrameRef = useRef(onFrame);
  const frameRef = useRef(null);
  const initialisedRef = useRef(false);

  /*
   * The loop reads these through refs so it never has to be torn down and
   * rebuilt when a control changes. They are synced after render rather than
   * during it, which is what React 19 requires.
   */
  useEffect(() => {
    sizeRef.current = { width, height };
    followRef.current = follow;
    onFrameRef.current = onFrame;
  });

  useEffect(() => {
    const stage = stageRef.current;
    const lens = lensRef.current;

    if (!stage || !lens) {
      return undefined;
    }

    const state = stateRef.current;
    const variableCache = new Map();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let stageRect = stage.getBoundingClientRect();
    let lastNow = 0;
    let accumulator = 0;

    function measureStage() {
      stageRect = stage.getBoundingClientRect();
      centreOnFirstMeasurement();
    }

    /*
     * The stage can still be unlaid-out when the effect first runs, which would
     * clamp the starting position to 0,0. Centring is deferred until a
     * measurement actually has size.
     */
    function centreOnFirstMeasurement() {
      if (initialisedRef.current || stageRect.width < 1 || stageRect.height < 1) {
        return;
      }

      const { width: lensWidth, height: lensHeight } = sizeRef.current;
      const start = {
        x: clamp(
          stageRect.width * 0.5 - lensWidth * 0.5,
          0,
          Math.max(0, stageRect.width - lensWidth),
        ),
        y: clamp(
          stageRect.height * 0.5 - lensHeight * 0.5,
          0,
          Math.max(0, stageRect.height - lensHeight),
        ),
      };

      state.x = start.x;
      state.y = start.y;
      state.targetX = start.x;
      state.targetY = start.y;
      initialisedRef.current = true;
    }

    /* Keep the whole lens inside the stage, in stage-local coordinates. */
    function clampTarget(x, y) {
      const { width: lensWidth, height: lensHeight } = sizeRef.current;

      return {
        x: clamp(x, 0, Math.max(0, stageRect.width - lensWidth)),
        y: clamp(y, 0, Math.max(0, stageRect.height - lensHeight)),
      };
    }

    function centreOn(clientX, clientY) {
      const { width: lensWidth, height: lensHeight } = sizeRef.current;

      return clampTarget(
        clientX - stageRect.left - lensWidth * 0.5,
        clientY - stageRect.top - lensHeight * 0.5,
      );
    }

    function setTarget(point) {
      state.targetX = point.x;
      state.targetY = point.y;
      requestFrame();
    }

    centreOnFirstMeasurement();

    function requestFrame() {
      if (frameRef.current === null) {
        frameRef.current = requestAnimationFrame(runFrame);
      }
    }

    function integrate(step) {
      const { stiffness, damping, mass } = SPRING;
      const forceX = (state.targetX - state.x) * stiffness - state.vx * damping;
      const forceY = (state.targetY - state.y) * stiffness - state.vy * damping;

      state.vx += (forceX / mass) * step;
      state.vy += (forceY / mass) * step;
      state.x += state.vx * step;
      state.y += state.vy * step;
    }

    function settle() {
      state.x = state.targetX;
      state.y = state.targetY;
      state.vx = 0;
      state.vy = 0;
    }

    function isAtRest() {
      return (
        Math.abs(state.targetX - state.x) < REST_EPSILON &&
        Math.abs(state.targetY - state.y) < REST_EPSILON &&
        Math.hypot(state.vx, state.vy) < 1 &&
        Math.abs(state.hoverTarget - state.hover) < 0.002 &&
        Math.abs(state.pressTarget - state.press) < 0.002 &&
        state.speed < 0.002
      );
    }

    function updateDerivedValues() {
      const rawSpeed = Math.hypot(state.vx, state.vy);
      const normalisedSpeed = saturate(rawSpeed / SPEED_REFERENCE);

      state.speed = lerp(state.speed, normalisedSpeed, STATE_LERP);
      state.hover = lerp(state.hover, state.hoverTarget, STATE_LERP);
      state.press = lerp(state.press, state.pressTarget, STATE_LERP * 1.6);

      if (rawSpeed > 12) {
        // Heading only follows real movement, otherwise it jitters at rest.
        state.headingX = lerp(state.headingX, state.vx / rawSpeed, STATE_LERP);
        state.headingY = lerp(state.headingY, state.vy / rawSpeed, STATE_LERP);
      }

      state.stretch = state.speed * MAX_STRETCH;
    }

    function write() {
      const angle = (Math.atan2(state.headingY, state.headingX) * 180) / Math.PI;

      writeVariable(variableCache, lens, "--lens-x", `${state.x.toFixed(2)}px`);
      writeVariable(variableCache, lens, "--lens-y", `${state.y.toFixed(2)}px`);
      writeVariable(variableCache, lens, "--lens-angle", `${angle.toFixed(2)}deg`);
      writeVariable(variableCache, lens, "--lens-speed", state.speed.toFixed(4));
      writeVariable(variableCache, lens, "--lens-stretch", state.stretch.toFixed(4));
      writeVariable(variableCache, lens, "--lens-hover", state.hover.toFixed(4));
      writeVariable(variableCache, lens, "--lens-press", state.press.toFixed(4));
      writeVariable(
        variableCache,
        lens,
        "--lens-heading-x",
        state.headingX.toFixed(4),
      );
      writeVariable(
        variableCache,
        lens,
        "--lens-heading-y",
        state.headingY.toFixed(4),
      );
    }

    function runFrame(now) {
      frameRef.current = null;

      const delta = Math.min(MAX_FRAME_TIME, (now - (lastNow || now)) / 1000);
      lastNow = now;

      if (reducedMotion.matches) {
        settle();
      } else {
        accumulator = Math.min(accumulator + delta, MAX_FRAME_TIME);

        while (accumulator >= FIXED_STEP) {
          integrate(FIXED_STEP);
          accumulator -= FIXED_STEP;
        }
      }

      updateDerivedValues();
      write();
      onFrameRef.current?.(state, stageRect);

      if (!isAtRest() || state.dragging || followRef.current) {
        requestFrame();
      }
    }

    function handleStagePointerMove(event) {
      if (event.pointerType === "touch" && !state.dragging) {
        return;
      }

      if (state.dragging) {
        setTarget(
          clampTarget(
            event.clientX - stageRect.left - state.grabX,
            event.clientY - stageRect.top - state.grabY,
          ),
        );
        return;
      }

      if (followRef.current) {
        setTarget(centreOn(event.clientX, event.clientY));
      }
    }

    /* Click anywhere on the colourful content to send the selector there. */
    function handleStagePointerDown(event) {
      if (followRef.current || lens.contains(event.target)) {
        return;
      }

      setTarget(centreOn(event.clientX, event.clientY));
    }

    function handleLensPointerDown(event) {
      if (followRef.current) {
        return;
      }

      state.dragging = true;
      state.pressTarget = 1;
      state.grabX = event.clientX - stageRect.left - state.x;
      state.grabY = event.clientY - stageRect.top - state.y;
      lens.setPointerCapture?.(event.pointerId);
      requestFrame();
    }

    function handleLensPointerUp(event) {
      if (!state.dragging) {
        return;
      }

      state.dragging = false;
      state.pressTarget = 0;
      lens.releasePointerCapture?.(event.pointerId);
      requestFrame();
    }

    function handleLensEnter() {
      state.hoverTarget = 1;
      requestFrame();
    }

    function handleLensLeave() {
      state.hoverTarget = 0;
      requestFrame();
    }

    function handleResize() {
      measureStage();
      setTarget(clampTarget(state.targetX, state.targetY));
    }

    stage.addEventListener("pointermove", handleStagePointerMove, { passive: true });
    stage.addEventListener("pointerdown", handleStagePointerDown, { passive: true });
    lens.addEventListener("pointerdown", handleLensPointerDown);
    lens.addEventListener("pointerup", handleLensPointerUp);
    lens.addEventListener("pointercancel", handleLensPointerUp);
    lens.addEventListener("pointerenter", handleLensEnter, { passive: true });
    lens.addEventListener("pointerleave", handleLensLeave, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("scroll", handleResize, { passive: true, capture: true });

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(stage);

    requestFrame();

    return () => {
      stage.removeEventListener("pointermove", handleStagePointerMove);
      stage.removeEventListener("pointerdown", handleStagePointerDown);
      lens.removeEventListener("pointerdown", handleLensPointerDown);
      lens.removeEventListener("pointerup", handleLensPointerUp);
      lens.removeEventListener("pointercancel", handleLensPointerUp);
      lens.removeEventListener("pointerenter", handleLensEnter);
      lens.removeEventListener("pointerleave", handleLensLeave);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [stageRef, lensRef]);

  return stateRef;
}
