import { useEffect, useRef, useState } from "react";
import LiquidGlassSurface from "../glass/LiquidGlassSurface.jsx";
import { LIQUID_DEFAULTS } from "../glass/liquidField.js";
import { useLiquidDemo } from "./useLiquidDemo.js";

const THEMES = ["lavender", "blue", "pink", "green"];

const CONTROL_GROUPS = [
  {
    title: "Dent",
    controls: [
      { key: "reach", label: "Reach inside", min: 40, max: 260, step: 1, unit: "px" },
      { key: "outsideReach", label: "Reach outside", min: 0, max: 120, step: 1, unit: "px" },
      { key: "dentRadius", label: "Dent radius", min: 10, max: 120, step: 1, unit: "px" },
      { key: "dentDepth", label: "Dent depth", min: 0, max: 2, step: 0.01 },
      { key: "dentSoftness", label: "Dent softness", min: 2, max: 80, step: 1, unit: "px" },
      { key: "neck", label: "Neck softness", min: 1, max: 120, step: 1, unit: "px" },
      { key: "stretch", label: "Drag stretch", min: 0, max: 1, step: 0.01 },
    ],
  },
  {
    title: "Bevel",
    controls: [
      { key: "bevel", label: "Bevel width", min: 4, max: 60, step: 1, unit: "px" },
      { key: "bevelHeight", label: "Bevel height", min: 2, max: 40, step: 1, unit: "px" },
    ],
  },
  {
    title: "Light",
    controls: [
      { key: "lightHeight", label: "Lamp height", min: 10, max: 300, step: 1, unit: "px" },
      { key: "falloff", label: "Falloff", min: 30, max: 300, step: 1, unit: "px" },
      { key: "glow", label: "Rim glow", min: 0, max: 1.5, step: 0.01 },
      { key: "specular", label: "Highlight", min: 0, max: 2, step: 0.01 },
      { key: "shininess", label: "Highlight sharpness", min: 2, max: 200, step: 1 },
      { key: "shade", label: "Dent shading", min: 0, max: 1, step: 0.01 },
      { key: "caustic", label: "Lens bands", min: 0, max: 2, step: 0.01 },
    ],
  },
  {
    title: "Motion",
    controls: [
      { key: "springStiffness", label: "Spring stiffness", min: 40, max: 400, step: 1 },
      { key: "springDamping", label: "Spring damping", min: 2, max: 40, step: 0.5 },
    ],
  },
  {
    title: "Performance",
    controls: [
      { key: "pixelRatio", label: "Pixel ratio cap", min: 0.5, max: 3, step: 0.25, unit: "×" },
      { key: "presence", label: "Fade-in distance", min: 60, max: 400, step: 1, unit: "px" },
    ],
  },
];

function formatValue(value, { step, unit = "" }) {
  const decimals = step >= 1 ? 0 : String(step).split(".")[1].length;
  return `${value.toFixed(decimals)}${unit}`;
}

function LiquidDemo() {
  const stageRef = useRef(null);
  const settingsRef = useRef(LIQUID_DEFAULTS);
  const debugRef = useRef(false);
  const invalidateRef = useRef(() => {});
  const statsRef = useRef(null);
  const [settings, setSettings] = useState(LIQUID_DEFAULTS);
  const [debug, setDebug] = useState(false);
  const [theme, setTheme] = useState("lavender");
  const [copied, setCopied] = useState(false);

  useLiquidDemo({ stageRef, settingsRef, debugRef, invalidateRef, statsRef });

  useEffect(() => {
    settingsRef.current = settings;
    debugRef.current = debug;
    invalidateRef.current();
  }, [settings, debug]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    invalidateRef.current({ theme: true });
  }, [theme]);

  function updateSetting(key, value) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function copySettings() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="liquid-demo">
      <div className="ambient-field" aria-hidden="true">
        <span className="ambient-field-blue" />
        <span className="ambient-field-violet" />
      </div>

      <main className="liquid-demo-stage" ref={stageRef}>
        <header className="liquid-demo-header">
          <p className="demo-label">Prototype</p>
          <h1>Liquid glass edges</h1>
          <p className="demo-muted">
            Move the pointer towards an edge or a corner. Nothing appears deep inside a card; the
            reaction builds as you approach the rim.
          </p>
        </header>

        <div className="liquid-demo-grid">
          <LiquidGlassSurface
            as="aside"
            variant="sidebar"
            radius={30}
            className="demo-sidebar"
            data-liquid-surface=""
          >
            <p className="demo-label">Detail panel</p>
            <h2>Ephemeral</h2>
            <p className="demo-muted">adj. lasting for a very short time</p>
            <p>The largest surface, so it is the one that tests the pixel budget.</p>
            <ul className="demo-list">
              <li>Reviewed 3 days ago</li>
              <li>Next review in 4 days</li>
              <li>Recall 82%</li>
            </ul>
          </LiquidGlassSurface>

          <div className="liquid-demo-column">
            <LiquidGlassSurface variant="card" radius={28} className="demo-card" data-liquid-surface="">
              <p className="demo-label">Word card</p>
              <h2>Serendipity</h2>
              <p className="demo-muted">Try the corners: the dent should merge with both edges.</p>
            </LiquidGlassSurface>

            <LiquidGlassSurface variant="panel" radius={20} className="demo-bar" data-liquid-surface="">
              <strong>Wide, thin surface</strong>
              <span className="demo-muted">
                Cross the middle line: the light should never jump between top and bottom.
              </span>
            </LiquidGlassSurface>

            <LiquidGlassSurface variant="panel" radius={28} className="demo-panel" data-liquid-surface="">
              <p className="demo-label">Nested</p>
              <p>A glass button inside a glass panel.</p>
              <LiquidGlassSurface
                as="button"
                type="button"
                variant="button"
                radius={18}
                className="demo-button"
                data-liquid-surface=""
              >
                Add word
              </LiquidGlassSurface>
            </LiquidGlassSurface>
          </div>
        </div>
      </main>

      <aside className="liquid-demo-controls" aria-label="Liquid layer settings">
        <div className="controls-head">
          <h2>Settings</h2>
          <label className="control-inline">
            Theme
            <select value={theme} onChange={(event) => setTheme(event.target.value)}>
              {THEMES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="control-inline">
            <input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} />
            Show height field
          </label>
        </div>

        {CONTROL_GROUPS.map((group) => (
          <fieldset key={group.title} className="control-group">
            <legend>{group.title}</legend>
            {group.controls.map((control) => (
              <label key={control.key} className="control-row">
                <span>{control.label}</span>
                <output>{formatValue(settings[control.key], control)}</output>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  step={control.step}
                  value={settings[control.key]}
                  onChange={(event) => updateSetting(control.key, Number(event.target.value))}
                />
              </label>
            ))}
          </fieldset>
        ))}

        <div className="controls-actions">
          <button type="button" onClick={copySettings}>
            {copied ? "Copied" : "Copy settings"}
          </button>
          <button type="button" onClick={() => setSettings(LIQUID_DEFAULTS)}>
            Reset
          </button>
        </div>
        <p className="controls-stats" ref={statsRef}>
          Move the pointer to start.
        </p>
      </aside>
    </div>
  );
}

export default LiquidDemo;
