import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { CanvasView } from "./CanvasView";
import { download, exportPng, svgDocument, type Drawings } from "./export";
import {
  defaults,
  freshLayer,
  modeNames,
  type Controls,
  type Layer,
  type Mode,
  type Project,
} from "./types";
import { validProject } from "./project";
import "./style.css";
const initial: Project = {
  version: 1,
  layers: [freshLayer()],
  annotations: true,
  grid: false,
  title: "Untitled study",
};
function restore() {
  try {
    const p = JSON.parse(localStorage.getItem("filament-project") || "null");
    return validProject(p) ? p : initial;
  } catch {
    return initial;
  }
}
const descriptions: Record<Mode, string> = {
  organic: "Tapered branches and bundled fibres grow around hollow chambers.",
  mechanical:
    "Paired rails, radial ribs and stretched cables form an open framework.",
  hybrid:
    "Organic fibres attach to a measured skeleton. Soft tissue meets structure.",
};
const parameters: {
  key: keyof Controls;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "density",
    label: "Density",
    hint: "Number of fibres and ribs",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "branching",
    label: "Branching",
    hint: "Growth depth and attachment count",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "tension",
    label: "Tension",
    hint: "Pull curves toward their anchor points",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "symmetry",
    label: "Symmetry",
    hint: "Opacity of a reflected counterpart",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "weight",
    label: "Line weight",
    hint: "Thickness in drawing units",
    min: 0.15,
    max: 2,
    step: 0.05,
  },
  {
    key: "texture",
    label: "Texture",
    hint: "Fine graphite-like hatch marks",
    min: 0,
    max: 100,
    step: 1,
  },
  {
    key: "distortion",
    label: "Distortion",
    hint: "Bend the spine and soften chamber contours",
    min: 0,
    max: 100,
    step: 1,
  },
];
function PlacementInput({
  value,
  min,
  max,
  step,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        const number = e.currentTarget.valueAsNumber;
        const next = Number.isFinite(number)
          ? Math.max(min, Math.min(max, number))
          : value;
        setDraft(String(next));
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.value = String(value);
          setDraft(String(value));
          e.currentTarget.blur();
        } else if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}
function App() {
  const [project, setProject] = useState<Project>(restore),
    [selected, setSelected] = useState(() => project.layers[0].id),
    [drawings, setDrawings] = useState<Drawings>({}),
    [busy, setBusy] = useState(true),
    [generationFailed, setGenerationFailed] = useState(false),
    [storageAvailable, setStorageAvailable] = useState(true),
    [notice, setNotice] = useState(""),
    [help, setHelp] = useState(false),
    [exporting, setExporting] = useState(false);
  const worker = useRef<Worker | null>(null),
    revision = useRef(0),
    file = useRef<HTMLInputElement>(null),
    noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active =
    project.layers.find((l) => l.id === selected) || project.layers[0];
  const notify = (message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(""), 4000);
  };
  useEffect(() => {
    const w = new Worker(new URL("./generator.worker.ts", import.meta.url), {
      type: "module",
    });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.id !== revision.current) return;
      setBusy(false);
      if (e.data.error) {
        setGenerationFailed(true);
        notify(e.data.error);
        return;
      }
      setGenerationFailed(false);
      setDrawings(
        Object.fromEntries(
          e.data.drawings.map(
            (d: { id: string; drawing: Drawings[string] }) => [d.id, d.drawing],
          ),
        ),
      );
    };
    w.onerror = () => {
      setBusy(false);
      setGenerationFailed(true);
      notify("The drawing worker stopped. Reload the page to restart it.");
    };
    return () => {
      w.terminate();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);
  // A short debounce coalesces slider input. Transforms reuse cached geometry in the worker.
  useEffect(() => {
    setBusy(true);
    const id = ++revision.current;
    const t = setTimeout(
      () => worker.current?.postMessage({ id, layers: project.layers }),
      90,
    );
    return () => clearTimeout(t);
  }, [project.layers]);
  useEffect(() => {
    try {
      localStorage.setItem("filament-project", JSON.stringify(project));
      setStorageAvailable(true);
    } catch {
      setStorageAvailable(false);
      notify(
        "Browser storage is unavailable. Save a project file to keep this drawing.",
      );
    }
  }, [project]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement;
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelp(false);
      if (e.key === "Tab") {
        const buttons =
          document.querySelectorAll<HTMLButtonElement>(".help-modal button");
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [help]);
  const change = (updates: Partial<Layer>) =>
    setProject((p) => ({
      ...p,
      layers: p.layers.map((l) =>
        l.id === active.id ? { ...l, ...updates } : l,
      ),
    }));
  const control = (key: keyof Controls, value: number) =>
    change({ controls: { ...active.controls, [key]: value } });
  const addLayer = () => {
    if (project.layers.length >= 8) {
      notify("Eight layers maximum. Remove a layer to add another.");
      return;
    }
    const l = freshLayer(
      active.mode,
      String(Math.floor(Math.random() * 99999)),
    );
    l.name = `${modeNames[l.mode]} ${project.layers.length + 1}`;
    setProject((p) => ({ ...p, layers: [...p.layers, l] }));
    setSelected(l.id);
  };
  const duplicate = () => {
    if (project.layers.length >= 8) {
      notify("Eight layers maximum.");
      return;
    }
    const l = {
      ...active,
      id: crypto.randomUUID(),
      name: `${active.name.slice(0, 115)} copy`,
      controls: { ...active.controls },
      x: Math.min(500, active.x + 30),
    };
    setProject((p) => ({ ...p, layers: [...p.layers, l] }));
    setSelected(l.id);
  };
  const remove = () => {
    if (project.layers.length === 1) return;
    const ls = project.layers.filter((l) => l.id !== active.id);
    setProject((p) => ({ ...p, layers: ls }));
    setSelected(ls[ls.length - 1].id);
  };
  const move = (direction: number) =>
    setProject((p) => {
      const ls = [...p.layers],
        i = ls.findIndex((l) => l.id === active.id),
        j = i + direction;
      if (j < 0 || j >= ls.length) return p;
      [ls[i], ls[j]] = [ls[j], ls[i]];
      return { ...p, layers: ls };
    });
  const exportArt = async (kind: "svg" | "png") => {
    if (busy || generationFailed || exporting) return;
    try {
      setExporting(true);
      const svg = svgDocument(project, drawings);
      if (kind === "svg")
        download(
          new Blob([svg], { type: "image/svg+xml" }),
          "filament-drawing.svg",
        );
      else await exportPng(svg);
      notify(
        kind === "svg"
          ? "SVG exported. Layers stay editable."
          : "PNG exported at 2400 × 3000.",
      );
    } catch {
      notify("Export failed. Try SVG or reload the page.");
    } finally {
      setExporting(false);
    }
  };
  const importProject = async (f: File | undefined) => {
    if (!f) return;
    try {
      if (f.size > 100000) throw Error();
      const p = JSON.parse(await f.text());
      if (!validProject(p)) throw Error();
      setProject(p);
      setSelected(p.layers[0].id);
      notify("Project opened.");
    } catch {
      notify("This is not a valid Filament project file.");
    }
    if (file.current) file.current.value = "";
  };
  return (
    <>
      <header>
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
            <path
              d="M5 24C25 20 3 5 25 6M5 25C20 15 12 4 25 5M7 24C15 15 17 11 25 7M5 20C23 25 8 5 24 4"
              fill="none"
              stroke="currentColor"
              strokeWidth=".8"
            />
          </svg>
          <h1>
            Filament<span>Drawing studio</span>
          </h1>
        </div>
        <div className="header-center">A study in structure & growth</div>
        <nav aria-label="Project actions">
          <button onClick={() => setHelp(true)}>How it works</button>
          <button onClick={() => file.current?.click()}>Open</button>
          <button
            onClick={() => {
              download(
                new Blob([JSON.stringify(project, null, 2)], {
                  type: "application/json",
                }),
                "filament-project.json",
              );
              notify("Project saved with all seeds and controls.");
            }}
          >
            Save project
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => void importProject(e.target.files?.[0])}
          />
        </nav>
      </header>
      <main>
        <aside className="controls">
          <div className="panel-title">
            <span>Drawing system</span>
            <span className="small-marker">v.01</span>
          </div>
          <div
            className="mode-switch"
            role="group"
            aria-label="Generation mode"
          >
            {(["organic", "mechanical", "hybrid"] as Mode[]).map((mode, i) => (
              <button
                key={mode}
                aria-pressed={active.mode === mode}
                onClick={() => change({ mode, name: modeNames[mode] })}
              >
                <span className="mode-icon">{["⌁", "⌘", "⋈"][i]}</span>
                {["Organic", "Mechanical", "Hybrid"][i]}
              </button>
            ))}
          </div>
          <p className="mode-description">{descriptions[active.mode]}</p>
          <div className="seed-row">
            <label htmlFor="seed">
              Seed
              <input
                id="seed"
                value={active.seed}
                maxLength={80}
                onChange={(e) => change({ seed: e.target.value })}
              />
            </label>
            <button
              className="regenerate"
              onClick={() =>
                change({ seed: String(Math.floor(Math.random() * 999999)) })
              }
              title="Generate a new seed"
            >
              ↻<span>Regenerate</span>
            </button>
          </div>
          <div className="presets">
            <label htmlFor="preset">Starting point</label>
            <select
              id="preset"
              value=""
              onChange={(e) => {
                const presets: Record<string, Partial<Controls>> = {
                  delicate: {
                    density: 28,
                    branching: 35,
                    tension: 55,
                    texture: 12,
                    distortion: 25,
                    weight: 0.45,
                  },
                  dense: {
                    density: 90,
                    branching: 78,
                    tension: 28,
                    texture: 60,
                    distortion: 65,
                    weight: 0.7,
                  },
                  suspended: {
                    density: 38,
                    branching: 65,
                    tension: 85,
                    texture: 8,
                    distortion: 18,
                    weight: 0.65,
                  },
                };
                if (presets[e.target.value])
                  change({
                    controls: { ...defaults, ...presets[e.target.value] },
                  });
              }}
            >
              <option value="">Custom study</option>
              <option value="delicate">Delicate anatomy</option>
              <option value="dense">Dense entanglement</option>
              <option value="suspended">Suspended structure</option>
            </select>
          </div>
          <div className="parameter-list">
            {parameters.map((p) => (
              <label className="parameter" key={p.key} title={p.hint}>
                <span>
                  {p.label}
                  <output>
                    {p.key === "weight"
                      ? `${active.controls[p.key].toFixed(2)} px`
                      : String(active.controls[p.key]).padStart(2, "0")}
                  </output>
                </span>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={active.controls[p.key]}
                  aria-label={p.label}
                  onChange={(e) => control(p.key, Number(e.target.value))}
                />
              </label>
            ))}
          </div>
          <div className="toggle-row">
            <label>
              <input
                type="checkbox"
                checked={project.annotations}
                onChange={(e) =>
                  setProject((p) => ({ ...p, annotations: e.target.checked }))
                }
              />
              Annotations
            </label>
            <label>
              <input
                type="checkbox"
                checked={project.grid}
                onChange={(e) =>
                  setProject((p) => ({ ...p, grid: e.target.checked }))
                }
              />
              Grid
            </label>
          </div>
          <div className="control-note">
            Same seed. Same structure.
            <br />
            Change the rules to develop the drawing.
          </div>
        </aside>
        <CanvasView
          project={project}
          drawings={drawings}
          busy={busy}
          failed={generationFailed}
        />
        <aside className="composition">
          <div className="panel-title">
            Composition<span>{project.layers.length} / 8</span>
          </div>
          <label className="study-title">
            Study title
            <input
              value={project.title}
              maxLength={120}
              onChange={(e) =>
                setProject((p) => ({ ...p, title: e.target.value }))
              }
            />
          </label>
          <div className="layer-heading">
            <span>Layers</span>
            <button onClick={addLayer} aria-label="Add layer">
              + Add
            </button>
          </div>
          <div className="layers">
            {[...project.layers].reverse().map((l, i) => (
              <div
                key={l.id}
                className={`layer ${active.id === l.id ? "selected" : ""}`}
              >
                <button
                  className="visibility"
                  aria-label={`${l.visible ? "Hide" : "Show"} ${l.name}`}
                  aria-pressed={l.visible}
                  onClick={() =>
                    setProject((p) => ({
                      ...p,
                      layers: p.layers.map((a) =>
                        a.id === l.id ? { ...a, visible: !a.visible } : a,
                      ),
                    }))
                  }
                >
                  {l.visible ? "◉" : "○"}
                </button>
                <button
                  className="layer-select"
                  onClick={() => setSelected(l.id)}
                >
                  <span className="layer-number">
                    {String(project.layers.length - i).padStart(2, "0")}
                  </span>
                  <span>
                    {l.name}
                    <small>Seed {l.seed || "empty"}</small>
                  </span>
                </button>
              </div>
            ))}
          </div>
          <div className="layer-actions">
            <button onClick={duplicate}>Duplicate</button>
            <button
              onClick={() => move(1)}
              aria-label="Move layer up"
              disabled={
                project.layers.indexOf(active) === project.layers.length - 1
              }
            >
              ↑
            </button>
            <button
              onClick={() => move(-1)}
              aria-label="Move layer down"
              disabled={project.layers.indexOf(active) === 0}
            >
              ↓
            </button>
            <button onClick={remove} disabled={project.layers.length === 1}>
              Remove
            </button>
          </div>
          <div className="placement">
            <div className="panel-title">Layer placement</div>
            <label>
              Layer name
              <input
                value={active.name}
                maxLength={120}
                onChange={(e) => change({ name: e.target.value })}
              />
            </label>
            <label className="parameter">
              <span>
                Opacity<output>{Math.round(active.opacity * 100)}%</output>
              </span>
              <input
                aria-label="Layer opacity"
                type="range"
                min="0"
                max="1"
                step=".01"
                value={active.opacity}
                onChange={(e) => change({ opacity: +e.target.value })}
              />
            </label>
            <div className="number-grid">
              {(
                [
                  {
                    key: "x",
                    label: "Horizontal",
                    min: -500,
                    max: 500,
                    step: 5,
                  },
                  { key: "y", label: "Vertical", min: -625, max: 625, step: 5 },
                  {
                    key: "scale",
                    label: "Scale",
                    min: 0.2,
                    max: 2,
                    step: 0.05,
                  },
                  {
                    key: "rotation",
                    label: "Rotation",
                    min: -180,
                    max: 180,
                    step: 1,
                  },
                ] as const
              ).map((p) => (
                <label key={p.key}>
                  {p.label}
                  <PlacementInput
                    key={active.id}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    value={active[p.key]}
                    onCommit={(value) => change({ [p.key]: value })}
                  />
                </label>
              ))}
            </div>
            <button
              className="reset-placement"
              onClick={() =>
                change({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 })
              }
            >
              Reset placement
            </button>
          </div>
          <div className="export-panel">
            <div className="panel-title">Take it further</div>
            <p>Keep the lines editable, or export a print-sized image.</p>
            <div className="export-buttons">
              <button
                className="primary"
                disabled={busy || generationFailed || exporting}
                onClick={() => void exportArt("svg")}
              >
                Export SVG <span>↗</span>
              </button>
              <button
                disabled={busy || generationFailed || exporting}
                onClick={() => void exportArt("png")}
              >
                PNG <span>↗</span>
              </button>
            </div>
            <span className="export-detail">Full sheet / White background</span>
          </div>
        </aside>
      </main>
      <footer>
        <span>Corey Kavanagh / Creative coding studies</span>
        <span>
          {Object.values(drawings)
            .reduce((sum, d) => sum + d.strokes, 0)
            .toLocaleString()}{" "}
          strokes <span className="footer-divider">/</span> Seeded &
          reproducible
        </span>
        <span>
          {storageAvailable
            ? "Saved in this browser"
            : "Save a project file to keep this drawing"}
        </span>
      </footer>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="close"
              aria-label="Close guide"
              autoFocus
              onClick={() => setHelp(false)}
            >
              ×
            </button>
            <span className="small-marker">Field notes</span>
            <h2 id="help-title">
              Give the drawing
              <br />a set of rules.
            </h2>
            <p>
              Filament makes line drawings from structure. A seeded spine
              establishes the shape; fibres, branches, chambers and tension
              cables follow that shape.
            </p>
            <div className="help-columns">
              <div>
                <h3>Organic growth</h3>
                <p>
                  Recursive buds split and taper. Curved fibre bundles surround
                  empty chambers. Density adds fibres; branching adds buds and
                  growth depth.
                </p>
              </div>
              <div>
                <h3>Mechanical framework</h3>
                <p>
                  Paired rails follow the spine. Ribs, circular hubs and
                  cross-bracing connect them. Tension tightens the curves
                  between anchors.
                </p>
              </div>
              <div>
                <h3>Hybrid systems</h3>
                <p>
                  Both systems share a spine. Fibres attach to the frame so the
                  result has an internal logic.
                </p>
              </div>
            </div>
            <p>
              Choose a starting point, adjust the controls, then add layers.
              Each layer keeps its own seed, mode and placement. Symmetry adds a
              reflected counterpart. Texture adds fine hatching; distortion
              bends the structure.
            </p>
            <p>
              Drag the sheet to pan and scroll to zoom. Keyboard: arrow keys
              pan, + and − zoom, 0 fits the sheet. Exports contain the full
              sheet, regardless of your view. SVG retains vector layers; PNG is
              2400 × 3000 pixels. Save a project to return to its exact
              settings.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Back to drawing
            </button>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
