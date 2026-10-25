import type { Controls, Drawing, Mode } from "./types";
type P = { x: number; y: number };
const tau = Math.PI * 2;
export function random(seed: string) {
  let s = 2166136261;
  for (const c of seed) s = Math.imul(s ^ c.charCodeAt(0), 16777619);
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const n = (v: number) => v.toFixed(2);
const pt = (p: P) => `${n(p.x)},${n(p.y)}`;
function spline(ps: P[], tension: number) {
  if (ps.length < 2) return "";
  let d = `M${pt(ps[0])}`;
  const k = (1 - tension * 0.006) / 6;
  for (let i = 0; i < ps.length - 1; i++) {
    const a = ps[Math.max(0, i - 1)],
      b = ps[i],
      c = ps[i + 1],
      e = ps[Math.min(ps.length - 1, i + 2)];
    d += `C${pt({ x: b.x + (c.x - a.x) * k, y: b.y + (c.y - a.y) * k })} ${pt({ x: c.x - (e.x - b.x) * k, y: c.y - (e.y - b.y) * k })} ${pt(c)}`;
  }
  return d;
}
/** A shared anatomical spine drives fibres, chambers and constrained drafting geometry. */
export function generate(mode: Mode, seed: string, c: Controls): Drawing {
  const r = random(seed),
    fibreRandom = random(seed + " / fibres"),
    range = (a: number, b: number) => a + (b - a) * r();
  const groups: Drawing["groups"] = [],
    anchors: P[] = [];
  let strokes = 0;
  const buckets = new Map<
    string,
    { d: string; width: number; opacity: number }
  >();
  const add = (d: string, w = 0.65, o = 0.55) => {
    if (strokes >= 4800) return;
    const width = +(w * c.weight).toFixed(3),
      opacity = +o.toFixed(2),
      key = `${width}:${opacity}`;
    let g = buckets.get(key);
    if (!g) {
      g = { d: "", width, opacity };
      buckets.set(key, g);
    }
    g.d += d;
    strokes++;
  };
  const line = (a: P, b: P, w = 0.6, o = 0.4) =>
    add(`M${pt(a)}L${pt(b)}`, w, o);
  const phase = range(0, tau),
    distortion = c.distortion / 100;
  const spine: P[] = Array.from({ length: 11 }, (_, i) => ({
    x:
      500 +
      Math.sin(i * 0.67 + phase) * (65 + distortion * 115) +
      Math.sin(i * 1.6) * distortion * 40,
    y: 225 + i * 77,
  }));
  const samples = (a: P, b: P, bend: number, steps = 18): P[] =>
    Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps,
        dx = b.x - a.x,
        dy = b.y - a.y,
        len = Math.hypot(dx, dy) || 1;
      const off = Math.sin(t * Math.PI) * bend;
      return {
        x: a.x + dx * t - (dy / len) * off,
        y: a.y + dy * t + (dx / len) * off,
      };
    });
  const bundle = (ps: P[], radius: number, count: number) => {
    for (let j = 0; j < count; j++) {
      const f = (j / (count - 1 || 1) - 0.5) * 2,
        wiggle = fibreRandom() * tau;
      const points = ps.map((p, i) => {
        const prev = ps[Math.max(0, i - 1)],
          next = ps[Math.min(ps.length - 1, i + 1)],
          dx = next.x - prev.x,
          dy = next.y - prev.y,
          len = Math.hypot(dx, dy) || 1,
          t = i / (ps.length - 1);
        const envelope = Math.sin(Math.PI * t) ** 0.6;
        const offset =
          f * radius * envelope +
          Math.sin(t * 12 + wiggle) * distortion * 3 * envelope;
        return { x: p.x - (dy / len) * offset, y: p.y + (dx / len) * offset };
      });
      add(
        spline(points, c.tension),
        j % 9 === 0 ? 1.1 : 0.65,
        j % 7 === 0 ? 0.7 : 0.25,
      );
    }
  };
  const chamber = (
    center: P,
    rx: number,
    ry: number,
    angle: number,
    organic: boolean,
  ) => {
    const point = (t: number, offset = 0): P => {
      const wobble = organic
        ? 1 +
          Math.sin(t * 3 + phase) * distortion * 0.22 +
          Math.cos(t * 5) * 0.07
        : 1;
      const x = Math.cos(t) * (rx + offset) * wobble,
        y = Math.sin(t) * (ry + offset) * wobble;
      return {
        x: center.x + x * Math.cos(angle) - y * Math.sin(angle),
        y: center.y + x * Math.sin(angle) + y * Math.cos(angle),
      };
    };
    for (let j = 0; j < 4; j++) {
      const ps = Array.from({ length: 65 }, (_, i) =>
        point((i / 64) * tau, j * 2),
      );
      add(spline(ps, c.tension), j === 0 ? 1.5 : 0.55, j === 0 ? 0.75 : 0.3);
    }
    const ribCount = Math.round(24 + c.density * 0.8);
    for (let i = 0; i < ribCount; i++) {
      const t = (i / ribCount) * tau,
        outer = point(t),
        inner = point(t + Math.sin(t * 2) * 0.22, -Math.min(rx, ry) * 0.63);
      add(
        spline(
          [
            outer,
            {
              x: (outer.x + inner.x) / 2 + Math.sin(t) * 12,
              y: (outer.y + inner.y) / 2 + Math.cos(t) * 8,
            },
            inner,
          ],
          c.tension,
        ),
        0.55,
        0.3,
      );
    }
    if (!organic) {
      line({ x: center.x - 8, y: center.y }, { x: center.x + 8, y: center.y });
      line({ x: center.x, y: center.y - 8 }, { x: center.x, y: center.y + 8 });
    }
    anchors.push(center);
  };
  if (mode !== "mechanical") {
    bundle(spine, 28 + range(0, 35), Math.round(20 + c.density * 1.2));
    const depthLimit = 2 + Math.floor(c.branching / 35),
      branchLimit = 25 + Math.round(c.branching * 0.7);
    let branches = 0;
    // Bounded recursive growth: buds bifurcate and taper rather than scattering particles.
    const grow = (start: P, angle: number, length: number, depth: number) => {
      if (depth > depthLimit || branches++ > branchLimit) return;
      const end = {
        x: Math.max(180, Math.min(820, start.x + Math.cos(angle) * length)),
        y: Math.max(165, Math.min(1060, start.y + Math.sin(angle) * length)),
      };
      const ps = samples(start, end, range(-50, 50) * distortion);
      bundle(
        ps,
        (11 + depth * 2) * (1 - depth * 0.14),
        Math.round(7 + (c.density * 0.35) / (depth + 1)),
      );
      if (depth < depthLimit) {
        grow(ps[12], angle + range(0.35, 0.95), length * 0.67, depth + 1);
        grow(end, angle - range(0.35, 0.85), length * 0.6, depth + 1);
      }
      if (depth === 1 && r() < 0.7)
        chamber(end, range(22, 60), range(25, 65), angle, true);
    };
    const buds = 3 + Math.floor(c.branching / 18);
    for (let i = 0; i < buds; i++) {
      const index = 1 + Math.floor((i / buds) * 8),
        side = i % 2 ? -1 : 1;
      grow(
        spine[index],
        side > 0 ? range(-0.7, 0.7) : Math.PI + range(-0.7, 0.7),
        range(105, 200),
        0,
      );
    }
    for (let i = 0; i < 5; i++) {
      const p = spine[2 + (i % 7)];
      chamber(
        { x: p.x + range(-65, 65), y: p.y + range(-20, 20) },
        range(25, 65),
        range(40, 85),
        range(-1, 1),
        true,
      );
    }
    // Short streamlines curl around anatomical anchors in a spatially coherent field.
    // Their own random stream keeps structural anchors stable when density changes.
    const flowRandom = random(seed + " / flow");
    for (let i = 0; i < 30 + Math.floor(c.density * 0.8); i++) {
      const hub = anchors[Math.floor(flowRandom() * anchors.length)],
        phase = flowRandom() * tau;
      let p = {
        x: hub.x + Math.cos(phase) * (20 + flowRandom() * 45),
        y: hub.y + Math.sin(phase) * (25 + flowRandom() * 50),
      };
      const ps: P[] = [p];
      for (let j = 0; j < 48; j++) {
        const a = Math.atan2(p.y - hub.y, p.x - hub.x) + Math.PI / 2;
        const field =
          Math.sin(p.x * 0.014 + phase) *
          Math.cos(p.y * 0.011) *
          distortion *
          0.85;
        p = {
          x: p.x + Math.cos(a + field) * 3.6,
          y: p.y + Math.sin(a + field) * 3.6,
        };
        ps.push(p);
      }
      add(spline(ps, c.tension), 0.6, i % 6 === 0 ? 0.55 : 0.22);
    }
  }
  if (mode !== "organic") {
    // Frames follow the same spine, with paired rails, radial ribs and tension cables.
    const left = spine.map((p, i) => ({
        x: p.x - 70 - Math.sin(i * 0.7) * 35,
        y: p.y,
      })),
      right = spine.map((p, i) => ({
        x: p.x + 70 + Math.cos(i * 0.6) * 40,
        y: p.y,
      }));
    for (let j = 0; j < 5; j++) {
      add(
        spline(
          left.map((p) => ({ x: p.x + j * 2, y: p.y })),
          c.tension,
        ),
        j ? 0.6 : 1.4,
        0.6,
      );
      add(
        spline(
          right.map((p) => ({ x: p.x + j * 2, y: p.y })),
          c.tension,
        ),
        j ? 0.6 : 1.4,
        0.6,
      );
    }
    for (let i = 0; i < 10; i++) {
      line(left[i], right[i], 0.7, 0.45);
      line(left[i], right[i + 1], 0.55, 0.3);
      line(right[i], left[i + 1], 0.55, 0.3);
      const cnt = Math.floor(5 + c.density * 0.16);
      for (let j = 0; j < cnt; j++) {
        const t = j / cnt;
        line(
          {
            x: left[i].x + (left[i + 1].x - left[i].x) * t,
            y: left[i].y + 77 * t,
          },
          {
            x: right[i].x + (right[i + 1].x - right[i].x) * t,
            y: right[i].y + 77 * t,
          },
          0.45,
          0.18,
        );
      }
    }
    const count = 3 + Math.floor(c.branching / 22);
    for (let i = 0; i < count; i++) {
      const at = spine[1 + Math.floor((i / count) * 8)],
        side = i % 2 ? -1 : 1;
      const hub = { x: at.x + side * range(90, 155), y: at.y + range(-35, 35) };
      chamber(hub, range(38, 78), range(40, 87), range(-0.7, 0.7), false);
      line(at, hub, 1.5, 0.65);
      const far = spine[Math.min(10, 3 + Math.floor((i / count) * 8))];
      for (let j = 0; j < Math.floor(8 + c.density * 0.5); j++) {
        const t = (j / (8 + c.density * 0.5)) * tau;
        line(
          { x: hub.x + Math.cos(t) * 55, y: hub.y + Math.sin(t) * 55 },
          far,
          0.5,
          0.22,
        );
      }
    }
    // Detached measuring rails and attachment points preserve open space around the object.
    for (let i = 0; i < 10; i++) {
      const p = i % 2 ? left[i] : right[i];
      const q = { x: p.x + (i % 2 ? -1 : 1) * range(35, 95), y: p.y - 35 };
      line(p, q, 0.5, 0.35);
      add(`M${n(q.x - 2)},${n(q.y)}a2,2 0 1,0 4,0a2,2 0 1,0 -4,0`, 0.8, 0.7);
      anchors.push(q);
    }
  }
  if (c.texture > 0) {
    const count = Math.floor(c.texture * (3 + c.density * 0.09));
    for (let i = 0; i < count; i++) {
      const a = spine[Math.floor(range(0, 11))],
        p = { x: a.x + range(-115, 115), y: a.y + range(-45, 45) };
      line(p, { x: p.x + range(3, 15), y: p.y + range(-10, 10) }, 0.4, 0.18);
    }
  }
  groups.push(...buckets.values());
  if (c.symmetry > 0) {
    const mirror = groups.map((g) => ({
      ...g,
      d: g.d,
      opacity: (g.opacity * c.symmetry) / 100,
    }));
    // Reflect path coordinates, including cubic controls, without losing vector editability.
    for (const g of mirror)
      g.d = g.d.replace(
        /(-?\d+\.\d+),(-?\d+\.\d+)/g,
        (_, x, y) => `${n(1000 - Number(x))},${y}`,
      );
    groups.push(...mirror);
    strokes *= 2;
  }
  return { groups, anchors: anchors.slice(0, 14), strokes };
}
