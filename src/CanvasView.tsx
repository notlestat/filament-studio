import { useEffect, useRef, useState } from "react";
import type { Project } from "./types";
import { annotations, type Drawings } from "./export";
type View = { zoom: number; x: number; y: number };
export function CanvasView({
  project,
  drawings,
  busy,
  failed,
}: {
  project: Project;
  drawings: Drawings;
  busy: boolean;
  failed: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    wrap = useRef<HTMLDivElement>(null),
    [size, setSize] = useState({ w: 800, h: 800 }),
    [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 }),
    drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(
      null,
    );
  const paths = useRef(new Map<string, Path2D>());
  const opacityCanvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const el = wrap.current!;
    const o = new ResizeObserver(([e]) =>
      setSize({ w: e.contentRect.width, h: e.contentRect.height }),
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    const map = new Map<string, Path2D>();
    Object.values(drawings).forEach((d) =>
      d.groups.forEach((g) =>
        map.set(g.d, paths.current.get(g.d) || new Path2D(g.d)),
      ),
    );
    paths.current = map;
  }, [drawings]);
  const fit = Math.min((size.w - 90) / 1000, (size.h - 90) / 1250);
  useEffect(() => {
    const c = canvas.current!,
      ctx = c.getContext("2d")!,
      dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size.w, size.h);
    const s = fit * view.zoom;
    ctx.translate(size.w / 2 + view.x, size.h / 2 + view.y);
    ctx.scale(s, s);
    ctx.translate(-500, -625);
    ctx.shadowColor = "#182b4020";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, 1000, 1250);
    ctx.shadowColor = "transparent";
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, 1000, 1250);
    ctx.clip();
    if (project.grid) {
      ctx.strokeStyle = "#d5d8dc";
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      for (let i = 0; i <= 1250; i += 25) {
        ctx.moveTo(0, i);
        ctx.lineTo(1000, i);
        if (i <= 1000) {
          ctx.moveTo(i, 0);
          ctx.lineTo(i, 1250);
        }
      }
      ctx.stroke();
    }
    project.layers.forEach((l) => {
      const d = drawings[l.id];
      if (!l.visible || !d) return;
      // SVG applies opacity to a whole layer after its strokes overlap.
      // Reuse a transparent buffer so the Canvas preview composites the same way.
      let target = ctx;
      let buffer: HTMLCanvasElement | null = null;
      if (l.opacity < 1) {
        buffer = opacityCanvas.current ??= document.createElement("canvas");
        buffer.width = c.width;
        buffer.height = c.height;
        target = buffer.getContext("2d")!;
        target.setTransform(ctx.getTransform());
      }
      target.save();
      target.translate(500 + l.x, 625 + l.y);
      target.rotate((l.rotation * Math.PI) / 180);
      target.scale(l.scale, l.scale);
      target.translate(-500, -625);
      target.strokeStyle = "#20282e";
      target.lineCap = "round";
      target.lineJoin = "round";
      d.groups.forEach((g) => {
        target.globalAlpha = g.opacity;
        target.lineWidth = g.width;
        target.stroke(paths.current.get(g.d)!);
      });
      if (project.annotations) {
        target.globalAlpha = 1;
        target.lineWidth = 0.45;
        target.strokeStyle = "#9aa5af";
        target.fillStyle = "#52606b";
        target.font = "8px monospace";
        annotations(d).forEach(({ p, side, x, y, label }) => {
          target.beginPath();
          target.moveTo(p.x, p.y);
          target.lineTo(x, y);
          target.lineTo(x + side * 24, y);
          target.stroke();
          target.beginPath();
          target.arc(p.x, p.y, 2, 0, Math.PI * 2);
          target.fillStyle = "white";
          target.fill();
          target.stroke();
          target.fillStyle = "#52606b";
          target.textAlign = side > 0 ? "left" : "right";
          target.fillText(label, x + side * 28, y + 3);
        });
      }
      target.restore();
      if (buffer) {
        ctx.save();
        ctx.resetTransform();
        ctx.globalAlpha = l.opacity;
        ctx.drawImage(buffer, 0, 0);
        ctx.restore();
      }
    });
    ctx.restore();
  }, [project, drawings, size, view, fit]);
  useEffect(() => {
    const el = wrap.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect(),
        px = e.clientX - rect.left - size.w / 2,
        py = e.clientY - rect.top - size.h / 2;
      setView((v) => {
        const zoom = Math.max(
            0.35,
            Math.min(6, v.zoom * Math.exp(-e.deltaY * 0.0015)),
          ),
          ratio = zoom / v.zoom;
        return { zoom, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio };
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, [size]);
  return (
    <section className="drawing-area">
      <div className="sheet-meta">
        <span>{project.title}</span>
        <span>1000 × 1250 / Portrait</span>
      </div>
      <div
        ref={wrap}
        className="canvas-wrap"
        tabIndex={0}
        role="application"
        aria-label="Drawing viewport. Drag to pan, scroll to zoom. Arrow keys pan, plus and minus zoom, zero fits the page."
        onKeyDown={(e) => {
          if (
            [
              "ArrowLeft",
              "ArrowRight",
              "ArrowUp",
              "ArrowDown",
              "+",
              "=",
              "-",
              "0",
            ].includes(e.key)
          ) {
            e.preventDefault();
            setView((v) =>
              e.key === "0"
                ? { zoom: 1, x: 0, y: 0 }
                : {
                    zoom:
                      e.key === "+" || e.key === "="
                        ? Math.min(6, v.zoom * 1.2)
                        : e.key === "-"
                          ? Math.max(0.35, v.zoom / 1.2)
                          : v.zoom,
                    x:
                      v.x +
                      (e.key === "ArrowLeft"
                        ? 30
                        : e.key === "ArrowRight"
                          ? -30
                          : 0),
                    y:
                      v.y +
                      (e.key === "ArrowUp"
                        ? 30
                        : e.key === "ArrowDown"
                          ? -30
                          : 0),
                  },
            );
          }
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d)
            setView((v) => ({
              ...v,
              x: d.vx + e.clientX - d.x,
              y: d.vy + e.clientY - d.y,
            }));
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <canvas
          ref={canvas}
          style={{ width: size.w, height: size.h }}
          aria-label="Generated monochrome architectural drawing"
        />
      </div>
      <div className="viewport-bottom">
        <span className="generation-status" aria-live="polite">
          <i className={busy ? "busy" : ""} />
          {failed
            ? "Generation failed. Change the rules or reload to retry."
            : busy
              ? "Developing drawing…"
              : "Drawing ready"}
        </span>
        <div className="zoom">
          <button
            aria-label="Zoom out"
            onClick={() =>
              setView((v) => ({ ...v, zoom: Math.max(0.35, v.zoom / 1.2) }))
            }
          >
            −
          </button>
          <span>{Math.round(view.zoom * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() =>
              setView((v) => ({ ...v, zoom: Math.min(6, v.zoom * 1.2) }))
            }
          >
            +
          </button>
          <button onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>
            Fit sheet
          </button>
        </div>
        <span className="pan-hint">Drag to pan / Scroll to zoom</span>
      </div>
    </section>
  );
}
