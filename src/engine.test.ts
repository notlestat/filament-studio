import { test } from "node:test";
import assert from "node:assert/strict";
import { generate } from "./engine";
import { defaults, type Mode } from "./types";
import { svgDocument } from "./export";
for (const mode of ["organic", "mechanical", "hybrid"] as Mode[]) {
  test(`${mode}: reproducible geometry, distinct seeds and bounded output`, () => {
    const a = generate(mode, "1047", defaults),
      b = generate(mode, "1047", defaults),
      c = generate(mode, "1048", defaults);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, c);
    assert.ok(a.strokes > 100);
    assert.ok(a.anchors.length > 0);
    assert.ok(a.groups.every((g) => g.width > 0 && !/NaN|Infinity/.test(g.d)));
    const extreme = generate(mode, "extreme", {
      density: 100,
      branching: 100,
      tension: 100,
      symmetry: 100,
      weight: 2,
      texture: 100,
      distortion: 100,
    });
    assert.ok(extreme.strokes < 10000);
    assert.ok(extreme.groups.every((g) => !/NaN|Infinity/.test(g.d)));
  });
}
test("all seven controls change drawing geometry or style", () => {
  const a = JSON.stringify(generate("hybrid", "1047", defaults));
  for (const key of Object.keys(defaults)) {
    assert.notEqual(
      JSON.stringify(
        generate("hybrid", "1047", {
          ...defaults,
          [key]: key === "weight" ? 1.5 : 90,
        }),
      ),
      a,
      key,
    );
  }
});
test("export escapes project text, preserves layer transforms and omits hidden layers", () => {
  const d = generate("hybrid", "1047", defaults);
  const layer = {
    id: "one",
    name: "Test <layer>",
    mode: "hybrid" as const,
    seed: "1047",
    controls: defaults,
    visible: true,
    opacity: 0.4,
    x: 80,
    y: -50,
    rotation: 15,
    scale: 0.8,
  };
  const p = {
    version: 1 as const,
    title: "A <study> & B",
    annotations: true,
    grid: true,
    layers: [layer, { ...layer, id: "hidden", visible: false }],
  };
  const svg = svgDocument(p, { one: d, hidden: d });
  assert.ok(svg.includes("A &lt;study&gt; &amp; B"));
  assert.ok(svg.includes("translate(580 575) rotate(15) scale(0.8)"));
  assert.ok(svg.includes('id="layer-one"'));
  assert.ok(!svg.includes('id="layer-hidden"'));
  assert.ok(svg.includes("branch junction"));
});
