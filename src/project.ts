import { defaults, type Controls, type Project } from "./types";

export function validProject(p: unknown): p is Project {
  if (!p || typeof p !== "object") return false;
  const q = p as Project;
  return (
    q.version === 1 &&
    typeof q.title === "string" &&
    q.title.length <= 120 &&
    typeof q.annotations === "boolean" &&
    typeof q.grid === "boolean" &&
    Array.isArray(q.layers) &&
    q.layers.length > 0 &&
    q.layers.length <= 8 &&
    q.layers.every(
      (l) =>
        l &&
        typeof l.id === "string" &&
        typeof l.name === "string" &&
        l.name.length <= 120 &&
        typeof l.seed === "string" &&
        l.seed.length <= 80 &&
        ["organic", "mechanical", "hybrid"].includes(l.mode) &&
        typeof l.visible === "boolean" &&
        Number.isFinite(l.opacity) &&
        l.opacity >= 0 &&
        l.opacity <= 1 &&
        Number.isFinite(l.x) &&
        Math.abs(l.x) <= 500 &&
        Number.isFinite(l.y) &&
        Math.abs(l.y) <= 625 &&
        Number.isFinite(l.scale) &&
        l.scale >= 0.2 &&
        l.scale <= 2 &&
        Number.isFinite(l.rotation) &&
        Math.abs(l.rotation) <= 180 &&
        l.controls &&
        Object.keys(defaults).every((k) => {
          const value = l.controls[k as keyof Controls];
          return (
            Number.isFinite(value) &&
            value >= (k === "weight" ? 0.15 : 0) &&
            value <= (k === "weight" ? 2 : 100)
          );
        }),
    ) &&
    new Set(q.layers.map((l) => l.id)).size === q.layers.length
  );
}
