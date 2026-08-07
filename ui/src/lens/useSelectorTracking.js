import { useEffect, useRef, useState } from "react";
import { lerp, saturate } from "../glass/roundedRectField.js";

/*
 * Drives the glass selector across a list of rows.
 *
 * The demo lens is pointer-driven; this one is element-driven. The target is
 * the hovered row if there is one, otherwise the selected row, so the glass
 * previews under the cursor and falls back to the selection when the pointer
 * leaves. Position is sprung, size is snapped: the displacement map is a
 * function of the box, and rebuilding it mid-transition would be far too
 * expensive to do per frame.
 *
 * The target element is re-measured at the top of every frame, so reflows from
 * filtering, sorting or resizing are picked up without any invalidation
 * bookkeeping. The loop parks itself once settled, so that costs nothing at
 * rest.
 */

const FIXED_STEP = 1 / 120;
const MAX_FRAME_TIME = 0.05;
const SPRING = { stiffness: 210, damping: 23, mass: 1 };
const SPEED_REFERENCE = 2200;
const MAX_STRETCH = 0.05;
const STATE_LERP = 0.18;
const REST_EPSILON = 0.02;
const SIZE_EPSILON = 0.5;

function writeVariable(cache, element, name, value) {
  if (cache.get(name) === value) {
    return;
  }

  cache.set(name, value);
  element.style.setProperty(name, value);
}

export function useSelectorTracking({
  containerRef,
  selectorRef,
  activeKey,
  keyAttribute = "data-glass-row",
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const activeKeyRef = useRef(activeKey);
  const hoverKeyRef = useRef(null);
  const sizeRef = useRef(size);
  const stateRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    hover: 0,
    hoverTarget: 0,
    speed: 0,
    headingX: 0,
    headingY: 1,
    stretch: 0,
    visible: 0,
    visibleTarget: 0,
    placed: false,
  });
  const requestFrameRef = useRef(() => {});

  useEffect(() => {
    activeKeyRef.current = activeKey;
    sizeRef.current = size;
    requestFrameRef.current();
  });

  useEffect(() => {
    const container = containerRef.current;
    const selector = selectorRef.current;

    if (!container || !selector) {
      return undefined;
    }

    const state = stateRef.current;
    const variableCache = new Map();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = null;
    let lastNow = 0;
    let accumulator = 0;

    function requestFrame() {
      if (frame === null) {
        frame = requestAnimationFrame(runFrame);
      }
    }

    requestFrameRef.current = requestFrame;

    function findRow(key) {
      if (key === null || key === undefined) {
        return null;
      }

      return container.querySelector(
        `[${keyAttribute}="${CSS.escape(String(key))}"]`,
      );
    }

    function findTarget() {
      return findRow(hoverKeyRef.current) ?? findRow(activeKeyRef.current);
    }

    function measureTarget(element) {
      const containerRect = container.getBoundingClientRect();
      const rect = element.getBoundingClientRect();

      return {
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
      };
    }

    function integrate(step, targetX, targetY) {
      const { stiffness, damping, mass } = SPRING;
      const forceX = (targetX - state.x) * stiffness - state.vx * damping;
      const forceY = (targetY - state.y) * stiffness - state.vy * damping;

      state.vx += (forceX / mass) * step;
      state.vy += (forceY / mass) * step;
      state.x += state.vx * step;
      state.y += state.vy * step;
    }

    function write() {
      const angle = (Math.atan2(state.headingY, state.headingX) * 180) / Math.PI;

      writeVariable(variableCache, selector, "--sel-x", `${state.x.toFixed(2)}px`);
      writeVariable(variableCache, selector, "--sel-y", `${state.y.toFixed(2)}px`);
      writeVariable(variableCache, selector, "--sel-angle", `${angle.toFixed(2)}deg`);
      writeVariable(variableCache, selector, "--sel-speed", state.speed.toFixed(4));
      writeVariable(variableCache, selector, "--sel-stretch", state.stretch.toFixed(4));
      writeVariable(variableCache, selector, "--sel-hover", state.hover.toFixed(4));
      writeVariable(
        variableCache,
        selector,
        "--sel-visible",
        state.visible.toFixed(4),
      );
    }

    function runFrame(now) {

      const delta = Math.min(MAX_FRAME_TIME, (now - (lastNow || now)) / 1000);
      lastNow = now;

      const element = findTarget();

      if (!element) {
        state.visibleTarget = 0;
        state.placed = false;
      } else {
        state.visibleTarget = 1;

        const measured = measureTarget(element);
        const current = sizeRef.current;

        if (
          Math.abs(measured.width - current.width) > SIZE_EPSILON ||
          Math.abs(measured.height - current.height) > SIZE_EPSILON
        ) {
          // Snap, and let React rebuild the displacement map for the new box.
          sizeRef.current = { width: measured.width, height: measured.height };
          setSize(sizeRef.current);
        }

        if (!state.placed || reducedMotion.matches) {
          // First placement is a snap, opacity included: there is nothing to
          // animate from, and it must not depend on a frame ever arriving.
          state.x = measured.x;
          state.y = measured.y;
          state.vx = 0;
          state.vy = 0;
          state.visible = state.visibleTarget;
          state.placed = true;
        } else {
          accumulator = Math.min(accumulator + delta, MAX_FRAME_TIME);

          while (accumulator >= FIXED_STEP) {
            integrate(FIXED_STEP, measured.x, measured.y);
            accumulator -= FIXED_STEP;
          }
        }

        state.settleX = measured.x;
        state.settleY = measured.y;
      }

      const rawSpeed = Math.hypot(state.vx, state.vy);
      state.speed = lerp(state.speed, saturate(rawSpeed / SPEED_REFERENCE), STATE_LERP);
      state.hover = lerp(state.hover, state.hoverTarget, STATE_LERP);
      state.visible = lerp(state.visible, state.visibleTarget, STATE_LERP);
      state.stretch = state.speed * MAX_STRETCH;

      if (rawSpeed > 12) {
        state.headingX = lerp(state.headingX, state.vx / rawSpeed, STATE_LERP);
        state.headingY = lerp(state.headingY, state.vy / rawSpeed, STATE_LERP);
      }

      write();

      const positionSettled = element
        ? Math.abs(state.settleX - state.x) < REST_EPSILON &&
          Math.abs(state.settleY - state.y) < REST_EPSILON &&
          rawSpeed < 1
        : true;
      const settled =
        positionSettled &&
        Math.abs(state.hoverTarget - state.hover) < 0.002 &&
        Math.abs(state.visibleTarget - state.visible) < 0.002;

      if (!settled) {
        requestFrame();
      }
    }

    function handlePointerOver(event) {
      const row = event.target.closest?.(`[${keyAttribute}]`);
      const key = row?.getAttribute(keyAttribute) ?? null;

      if (key === hoverKeyRef.current) {
        return;
      }

      hoverKeyRef.current = key;
      state.hoverTarget = key === null ? 0 : 1;
      requestFrame();
    }

    function handlePointerLeave() {
      hoverKeyRef.current = null;
      state.hoverTarget = 0;
      requestFrame();
    }

    container.addEventListener("pointerover", handlePointerOver, { passive: true });
    container.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("resize", requestFrame, { passive: true });

    const resizeObserver = new ResizeObserver(requestFrame);
    resizeObserver.observe(container);

    /*
     * Place the selector synchronously before handing over to the frame loop.
     * requestAnimationFrame does not fire while the tab is hidden, so a purely
     * frame-driven first placement would leave the selector unpositioned and
     * invisible until the tab is next looked at.
     */
    runFrame(performance.now());
    requestFrame();

    return () => {
      container.removeEventListener("pointerover", handlePointerOver);
      container.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("resize", requestFrame);
      resizeObserver.disconnect();
      requestFrameRef.current = () => {};

      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    };
  }, [containerRef, selectorRef, keyAttribute]);

  return size;
}
