import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import { useHandwriting } from "../motion/handwriting.js";
import { writeWithPen } from "../motion/inkPen.js";
import { splitGlyphs, strokeDuration, strokeFor, strokeGap } from "../motion/inkStrokes.js";
import "./inkField.css";

/*
 * A text field that is written on rather than typed into. With Handwriting on
 * (Appearance), the field's own text is hidden and an overlay shows the same
 * text in the hand, laid exactly over it: each new glyph is written in with
 * the pen movement that suits it (motion/inkStrokes.js), a pen tip travels
 * over it as it is written (motion/inkPen.js), and its ink goes on wet and
 * dries; glyphs already written and dry stay as plain text. The field stays a real input, so the caret,
 * selection, spell check, autofill and screen readers all work as before.
 * While an input method is composing (pinyin, for instance) the field shows
 * its own text, and the committed characters are written in afterwards.
 *
 * Focusing any field inks its outline in from where it was clicked (or from
 * the start of the text, from the keyboard); see inkField.css.
 */

// What the overlay copies from its field, so each glyph lands over the
// field's own hidden text.
const MIRRORED = [
  "fontFamily", "fontSize", "fontWeight", "fontStyle", "fontStretch",
  "fontVariationSettings", "fontFeatureSettings", "fontKerning", "fontVariantLigatures",
  "letterSpacing", "wordSpacing", "lineHeight", "textTransform", "textIndent",
  "textAlign", "tabSize", "direction",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
];
// A textarea wraps its lines; the overlay has to wrap them the same way.
const MIRRORED_LINES = ["whiteSpace", "overflowWrap", "wordBreak"];

function createInk(value) {
  return {
    value,
    nextKey: 1,
    glyphs: splitGlyphs(value).map((text) => ({ text, key: 0 })),
    batch: null,
  };
}

// Glyphs are compared with the last text written: what's new between the
// unchanged start and end is written in, what's gone is simply gone.
function write(ink, value, animate) {
  const next = splitGlyphs(value);
  const previous = ink.glyphs;
  let start = 0;
  let previousEnd = previous.length;
  let nextEnd = next.length;

  while (start < previousEnd && start < nextEnd && previous[start].text === next[start]) {
    start += 1;
  }

  while (previousEnd > start && nextEnd > start &&
    previous[previousEnd - 1].text === next[nextEnd - 1]) {
    previousEnd -= 1;
    nextEnd -= 1;
  }

  const inserted = next.slice(start, nextEnd);
  const gap = animate ? strokeGap(inserted.filter(strokeFor).length) : 0;
  let nextKey = ink.nextKey;
  let order = 0;

  const written = inserted.map((text) => {
    const stroke = animate ? strokeFor(text) : null;

    if (!stroke) {
      return { text, key: 0 };
    }

    const glyph = {
      text,
      key: nextKey,
      stroke,
      delay: Math.round(order * gap),
      duration: strokeDuration(stroke),
    };
    nextKey += 1;
    order += 1;
    return glyph;
  });

  // The glyphs this change writes, for the pen to go over.
  const batch = written.filter((glyph) => glyph.key);

  return {
    value,
    nextKey,
    glyphs: [...previous.slice(0, start), ...written, ...previous.slice(previousEnd)],
    batch: batch.length ? batch : null,
  };
}

function inkReducer(ink, action) {
  if (action.type === "settle") {
    if (!ink.glyphs.some((glyph) => action.keys.has(glyph.key))) {
      return ink;
    }

    return {
      ...ink,
      glyphs: ink.glyphs.map((glyph) =>
        action.keys.has(glyph.key) ? { text: glyph.text, key: 0 } : glyph,
      ),
    };
  }

  return write(ink, action.value, action.animate);
}

// Written glyphs are joined back into plain text; only those still being
// written (or drying) are elements of their own.
function renderGlyphs(glyphs) {
  const nodes = [];
  let run = "";

  for (const glyph of glyphs) {
    if (!glyph.key) {
      run += glyph.text;
      continue;
    }

    if (run) {
      nodes.push(run);
      run = "";
    }

    nodes.push(
      <span
        key={glyph.key}
        className="ink-glyph"
        data-stroke={glyph.stroke}
        data-ink-key={glyph.key}
        style={{
          "--ink-delay": `${glyph.delay}ms`,
          "--ink-time": `${glyph.duration}ms`,
        }}
      >
        {glyph.text}
      </span>,
    );
  }

  if (run) {
    nodes.push(run);
  }

  return nodes;
}

function InkField({ as = "input", ref, value, onFocus, onCompositionStart, onCompositionEnd, ...props }) {
  const handwriting = useHandwriting();
  const reduce = useReducedMotion();
  const multiline = as === "textarea";
  const Field = multiline ? "textarea" : "input";
  const text = String(value ?? "");

  const wrapRef = useRef(null);
  const fieldRef = useRef(null);
  const overlayRef = useRef(null);
  const textRef = useRef(null);
  const penRef = useRef(null);
  const nibRef = useRef(null);
  const penMotion = useRef(null);
  const aimedByPointer = useRef(false);
  const settled = useRef({ keys: new Set(), frame: 0 });
  const [composing, setComposing] = useState(false);
  const [ink, dispatch] = useReducer(inkReducer, text, createInk);
  // The same elements while nothing is being written, so a re-render of the
  // form around the field (every keystroke in any field) skips the overlay.
  const written = useMemo(() => renderGlyphs(ink.glyphs), [ink.glyphs]);

  useEffect(() => {
    const pending = settled.current;
    return () => window.cancelAnimationFrame(pending.frame);
  }, []);

  // The pen goes over what was just written, from wherever it was.
  useLayoutEffect(() => {
    const layer = textRef.current;
    const pen = penRef.current;
    const nib = nibRef.current;

    if (!ink.batch || !handwriting || reduce || !layer || !pen || !nib) {
      return;
    }

    penMotion.current = writeWithPen({
      layer,
      pen,
      nib,
      glyphs: ink.batch,
      previous: penMotion.current,
    }) ?? penMotion.current;
  }, [handwriting, ink.batch, reduce]);

  // Strokes that finish in the same frame are joined back into the text in
  // one go, rather than one re-render each.
  function settle(key) {
    const pending = settled.current;
    pending.keys.add(key);

    if (!pending.frame) {
      pending.frame = window.requestAnimationFrame(() => {
        const keys = pending.keys;
        pending.keys = new Set();
        pending.frame = 0;
        dispatch({ type: "settle", keys });
      });
    }
  }

  useImperativeHandle(ref, () => fieldRef.current, []);

  // Keep up with the field. Nothing is written while an input method is
  // composing; its committed text is written in once it's done.
  useLayoutEffect(() => {
    if (!composing && ink.value !== text) {
      dispatch({ type: "write", value: text, animate: handwriting && !reduce });
    }
  }, [composing, handwriting, ink.value, reduce, text]);

  // Follow the field's scroll, so a long line or a long note stays in step.
  // The overlay is only touched when the scroll has actually moved.
  const follow = useCallback(() => {
    const field = fieldRef.current;
    const layer = textRef.current;

    if (!field || !layer) {
      return;
    }

    const transform = `translate(${-field.scrollLeft}px, ${-field.scrollTop}px)`;

    if (layer.style.transform !== transform) {
      layer.style.transform = transform;
    }
  }, []);

  // Lay the overlay exactly over the field and set it in the field's type.
  const align = useCallback(() => {
    const field = fieldRef.current;
    const overlay = overlayRef.current;
    const layer = textRef.current;

    if (!field || !overlay || !layer) {
      return;
    }

    const style = window.getComputedStyle(field);
    const copied = multiline ? [...MIRRORED, ...MIRRORED_LINES] : MIRRORED;

    for (const property of copied) {
      overlay.style[property] = style[property];
    }

    // Sizes keep their fractions (offsetWidth would round them), so a line
    // that only just fits in the field also fits in the overlay.
    const px = (property) => parseFloat(style[property]) || 0;
    const frame = style.boxSizing === "border-box"
      ? 0
      : px("paddingLeft") + px("paddingRight") + px("borderLeftWidth") + px("borderRightWidth");
    const frameHeight = style.boxSizing === "border-box"
      ? 0
      : px("paddingTop") + px("paddingBottom") + px("borderTopWidth") + px("borderBottomWidth");
    const width = px("width") + frame;

    overlay.style.top = `${field.offsetTop}px`;
    overlay.style.left = `${field.offsetLeft}px`;
    overlay.style.width = `${width}px`;
    overlay.style.height = `${px("height") + frameHeight}px`;

    if (multiline) {
      // A textarea wraps inside its padding and any scrollbar.
      const borders = px("borderLeftWidth") + px("borderRightWidth");
      const scrollbar = Math.max(0, field.offsetWidth - field.clientWidth - Math.round(borders));
      const inside = width - borders - scrollbar - px("paddingLeft") - px("paddingRight");
      layer.style.width = `${Math.max(0, inside)}px`;
    }

    follow();
  }, [follow, multiline]);

  useLayoutEffect(() => {
    if (handwriting) {
      align();
    }
  }, [align, handwriting]);

  useEffect(() => {
    const field = fieldRef.current;

    if (!handwriting || !field) {
      return undefined;
    }

    // While the field has focus its scroll can change on any keystroke, click
    // or drag, so the overlay follows it every frame; it rests otherwise.
    let frame = 0;
    const track = () => {
      follow();
      frame = window.requestAnimationFrame(track);
    };
    const start = () => {
      window.cancelAnimationFrame(frame);
      align();
      frame = window.requestAnimationFrame(track);
    };
    const stop = () => {
      window.cancelAnimationFrame(frame);
      follow();
    };

    field.addEventListener("focus", start);
    field.addEventListener("blur", stop);
    field.addEventListener("scroll", follow);

    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    observer?.observe(field);

    if (document.activeElement === field) {
      start();
    }

    return () => {
      window.cancelAnimationFrame(frame);
      field.removeEventListener("focus", start);
      field.removeEventListener("blur", stop);
      field.removeEventListener("scroll", follow);
      observer?.disconnect();
    };
  }, [align, follow, handwriting]);

  // Focus is inked in from where it starts: the point that was clicked, or
  // the start of the text from the keyboard. --focus-span is how far the ink
  // has to spread from there to reach every corner.
  function aimFocus(x, y) {
    const wrap = wrapRef.current;

    if (!wrap) {
      return;
    }

    const { width, height } = wrap.getBoundingClientRect();
    const span = Math.hypot(Math.max(x, width - x), Math.max(y, height - y));
    wrap.style.setProperty("--focus-x", `${Math.round(x)}px`);
    wrap.style.setProperty("--focus-y", `${Math.round(y)}px`);
    wrap.style.setProperty("--focus-span", `${Math.ceil(span)}px`);
  }

  return (
    <span
      ref={wrapRef}
      className="ink-field"
      data-ink={handwriting || undefined}
      data-multiline={multiline || undefined}
      data-composing={composing || undefined}
      onPointerDown={(event) => {
        // Only a click that brings focus decides where the ink starts.
        if (document.activeElement === fieldRef.current) {
          return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        aimFocus(event.clientX - bounds.left, event.clientY - bounds.top);
        aimedByPointer.current = true;
      }}
    >
      <Field
        {...props}
        ref={fieldRef}
        value={value}
        onFocus={(event) => {
          if (!aimedByPointer.current) {
            const style = window.getComputedStyle(event.currentTarget);
            const x = parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth);
            aimFocus(x, multiline ? parseFloat(style.lineHeight) / 2 || 16 : event.currentTarget.offsetHeight / 2);
          }

          aimedByPointer.current = false;
          onFocus?.(event);
        }}
        onCompositionStart={(event) => {
          setComposing(true);
          onCompositionStart?.(event);
        }}
        onCompositionEnd={(event) => {
          setComposing(false);
          onCompositionEnd?.(event);
        }}
      />

      {handwriting ? (
        <span ref={overlayRef} className="ink-field-overlay" aria-hidden="true" data-layout-ignore>
          <span className="ink-field-view">
            <span
              ref={textRef}
              className="ink-field-text"
              onAnimationEnd={(event) => {
                const key = Number(event.target.dataset?.inkKey);

                // A glyph is done once its ink has dried.
                if (key && event.animationName === "ink-dry") {
                  settle(key);
                }
              }}
            >
              {written}
              <span ref={penRef} className="ink-pen">
                <span ref={nibRef} className="ink-pen-nib" />
              </span>
            </span>
          </span>
        </span>
      ) : null}
    </span>
  );
}

export default InkField;
