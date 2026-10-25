import type { Drawing, Layer, Project } from "./types";
export type Drawings = Record<string, Drawing>;
export const escapeXml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export function svgDocument(project: Project, drawings: Drawings) {
  const grid = project.grid
    ? '<defs><pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse"><path d="M25 0H0V25" fill="none" stroke="#d5d8dc" stroke-width="0.35"/></pattern></defs><rect width="1000" height="1250" fill="url(#grid)"/>'
    : "";
  const layerSvg = (l: Layer) => {
    const d = drawings[l.id];
    if (!l.visible || !d) return "";
    return `<g id="layer-${escapeXml(l.id)}" opacity="${l.opacity}" transform="translate(${500 + l.x} ${625 + l.y}) rotate(${l.rotation}) scale(${l.scale}) translate(-500 -625)"><title>${escapeXml(l.name)}</title>${d.groups.map((g) => `<path d="${g.d}" fill="none" stroke="#20282e" stroke-width="${g.width}" opacity="${g.opacity}" stroke-linecap="round" stroke-linejoin="round"/>`).join("")}${project.annotations ? annotationSvg(d) : ""}</g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1250" viewBox="0 0 1000 1250"><title>${escapeXml(project.title)}</title><desc>Filament Studio. Seeded procedural drawing. ${escapeXml(JSON.stringify(project))}</desc><rect width="1000" height="1250" fill="white"/>${grid}${project.layers.map(layerSvg).join("")}</svg>`;
}
const annotationNames = [
  "branch junction",
  "radial chamber",
  "tension attachment",
  "membrane section",
  "growth terminal",
];
export function annotations(d: Drawing) {
  return d.anchors
    .filter((_, i) => i % 2 === 0)
    .map((p, i) => {
      const side = p.x > 500 ? 1 : -1;
      return {
        p,
        side,
        x: Math.max(230, Math.min(770, p.x + side * 90)),
        y: Math.max(80, Math.min(1170, p.y - 25)),
        label: `${annotationNames[i % 5]} / ${String(i + 1).padStart(2, "0")}`,
      };
    });
}
export function annotationSvg(d: Drawing) {
  return annotations(d)
    .map(
      ({ p, side, x, y, label }) =>
        `<g fill="#52606b" stroke="#9aa5af" stroke-width="0.45"><path d="M${p.x},${p.y}L${x},${y}h${side * 24}" fill="none"/><circle cx="${p.x}" cy="${p.y}" r="2" fill="white"/><text x="${x + side * 28}" y="${y + 3}" stroke="none" font-size="8" font-family="monospace" text-anchor="${side > 0 ? "start" : "end"}">${label}</text></g>`,
    )
    .join("");
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportPng(svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = 2400;
    c.height = 3000;
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob>((resolve, reject) =>
      c.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("PNG export failed"))),
        "image/png",
      ),
    );
    download(blob, "filament-drawing.png");
  } finally {
    URL.revokeObjectURL(url);
  }
}
