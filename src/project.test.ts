import { test } from "node:test";
import assert from "node:assert/strict";
import { validProject } from "./project";
import { freshLayer, type Project } from "./types";

const project = (): Project => ({
  version: 1,
  title: "Saved study",
  annotations: true,
  grid: false,
  layers: [freshLayer()],
});

test("saved settings round-trip and malformed layers are rejected without throwing", () => {
  const p = project();
  assert.equal(validProject(JSON.parse(JSON.stringify(p))), true);
  for (const layers of [[null], [false], [p.layers[0], p.layers[0]]]) {
    assert.equal(validProject({ ...p, layers }), false);
  }
});

test("imports reject invisible line weights and out-of-range settings", () => {
  for (const weight of [0, 0.1, 2.1, Infinity, NaN]) {
    const p = project();
    p.layers[0].controls.weight = weight;
    assert.equal(validProject(p), false, `weight ${weight}`);
  }
  for (const weight of [0.15, 0.65, 2]) {
    const p = project();
    p.layers[0].controls.weight = weight;
    assert.equal(validProject(p), true);
  }
});
