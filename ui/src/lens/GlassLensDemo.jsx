import { useEffect, useId, useRef, useState } from "react";
import GlassLens from "./GlassLens.jsx";
import { SUPPORTS_BACKDROP_DISPLACEMENT } from "./lensSupport.js";
import { createColourField } from "./colourField.js";
import { useLensMotion } from "./useLensMotion.js";
import { useLensOptics } from "./useLensOptics.js";

const CONTROLS = [
  { key: "size", label: "Lens size", min: 120, max: 380, step: 2, unit: "px" },
  { key: "blur", label: "Backdrop blur", min: 0, max: 24, step: 0.5, unit: "px" },
  { key: "strength", label: "Refraction", min: 0, max: 90, step: 1, unit: "px" },
  { key: "edge", label: "Edge width", min: 8, max: 120, step: 1, unit: "px" },
  { key: "bulge", label: "Bevel profile", min: 0.6, max: 6, step: 0.1, unit: "" },
  { key: "dispersion", label: "Dispersion", min: 0, max: 0.4, step: 0.01, unit: "" },
];

function GlassLensDemo() {
  const stageRef = useRef(null);
  const lensRef = useRef(null);
  const canvasRef = useRef(null);
  const fieldRef = useRef(null);
  const filterId = `lens-refraction-${useId().replace(/:/g, "")}`;
  const [settings, setSettings] = useState({
    size: 220,
    blur: 6,
    strength: 38,
    edge: 46,
    bulge: 2.4,
    dispersion: 0.12,
  });
  const [follow, setFollow] = useState(false);

  const handleFrame = useLensOptics({
    lensRef,
    fieldRef,
    filterId,
    size: settings.size,
    settings,
  });

  useLensMotion({
    stageRef,
    lensRef,
    width: settings.size,
    height: settings.size,
    follow,
    onFrame: handleFrame,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;

    if (!canvas || !stage) {
      return undefined;
    }

    const field = createColourField(canvas);
    fieldRef.current = field;

    function redraw() {
      const rect = stage.getBoundingClientRect();
      field.draw(rect.width, rect.height);
    }

    redraw();

    const resizeObserver = new ResizeObserver(redraw);
    resizeObserver.observe(stage);

    return () => {
      resizeObserver.disconnect();
      fieldRef.current = null;
    };
  }, []);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="lens-page">
      <header className="lens-header">
        <h1>Glass lens selector</h1>
        <p>
          Drag the selector, click anywhere on the artwork to send it there, or
          switch on cursor follow.
        </p>
        {SUPPORTS_BACKDROP_DISPLACEMENT ? null : (
          <p className="lens-warning">
            This browser does not resolve <code>url()</code> inside{" "}
            <code>backdrop-filter</code>, so the displacement pass is disabled
            and only the frosted pass and rim optics are shown.
          </p>
        )}
      </header>

      <div className="lens-stage" ref={stageRef}>
        <canvas className="lens-stage-canvas" ref={canvasRef} aria-hidden="true" />

        <div className="lens-stage-content">
          <p className="lens-stage-kicker">Refraction test surface</p>
          <h2 className="lens-stage-title">Liquid&nbsp;Glass</h2>
          <p className="lens-stage-body">
            Straight lines are the readout. A blur alone leaves them straight and
            merely soft; a displacement field bends them near the rim and pulls
            the surroundings inward.
          </p>
        </div>

        <GlassLens
          ref={lensRef}
          filterId={filterId}
          width={settings.size}
          height={settings.size}
          radius={Math.round(settings.size * 0.32)}
          edge={settings.edge}
          bulge={settings.bulge}
          strength={settings.strength}
          dispersion={settings.dispersion}
          blur={settings.blur}
          label="Selector"
        />
      </div>

      <div className="lens-controls">
        {CONTROLS.map((control) => (
          <label className="lens-control" key={control.key}>
            <span className="lens-control-label">
              {control.label}
              <em>
                {settings[control.key]}
                {control.unit}
              </em>
            </span>
            <input
              type="range"
              min={control.min}
              max={control.max}
              step={control.step}
              value={settings[control.key]}
              onChange={(event) =>
                updateSetting(control.key, Number(event.target.value))
              }
            />
          </label>
        ))}

        <label className="lens-control lens-control-toggle">
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => setFollow(event.target.checked)}
          />
          <span>Follow cursor</span>
        </label>
      </div>
    </div>
  );
}

export default GlassLensDemo;
