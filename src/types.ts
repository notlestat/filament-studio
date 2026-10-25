export type Mode = "organic" | "mechanical" | "hybrid";
export type Controls = {
  density: number;
  branching: number;
  tension: number;
  symmetry: number;
  weight: number;
  texture: number;
  distortion: number;
};
export type Layer = {
  id: string;
  name: string;
  mode: Mode;
  seed: string;
  controls: Controls;
  visible: boolean;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};
export type Drawing = {
  groups: { d: string; width: number; opacity: number }[];
  anchors: { x: number; y: number }[];
  strokes: number;
};
export type Project = {
  version: 1;
  layers: Layer[];
  annotations: boolean;
  grid: boolean;
  title: string;
};
export const defaults: Controls = {
  density: 55,
  branching: 55,
  tension: 45,
  symmetry: 0,
  weight: 0.65,
  texture: 25,
  distortion: 40,
};
export const modeNames: Record<Mode, string> = {
  organic: "Organic growth",
  mechanical: "Mechanical framework",
  hybrid: "Hybrid systems",
};
export const freshLayer = (mode: Mode = "hybrid", seed = "1047"): Layer => ({
  id: crypto.randomUUID(),
  name: modeNames[mode],
  mode,
  seed,
  controls: { ...defaults },
  visible: true,
  opacity: 1,
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
});
