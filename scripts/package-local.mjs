import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { zipSync, strToU8 } from "fflate";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const folder = `filament-studio-${manifest.version}-local`;
const files = {};
async function include(directory) {
  for (const entry of await readdir(join(root, directory), {
    withFileTypes: true,
  })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await include(path);
    else if (entry.isFile())
      files[
        `${folder}/${relative(root, join(root, path)).split("\\").join("/")}`
      ] = new Uint8Array(await readFile(join(root, path)));
  }
}
await include("dist");
files[`${folder}/scripts/serve.mjs`] = new Uint8Array(
  await readFile(join(root, "scripts/serve.mjs")),
);
files[`${folder}/package.json`] = strToU8(
  JSON.stringify(
    {
      name: manifest.name,
      version: manifest.version,
      private: true,
      type: "module",
      engines: manifest.engines,
      scripts: { start: "node scripts/serve.mjs" },
    },
    null,
    2,
  ) + "\n",
);
files[`${folder}/START-HERE.md`] = new Uint8Array(
  await readFile(join(root, "docs/LOCAL-USE.md")),
);
const notices = await Promise.all(
  [
    ["react", "LICENSE"],
    ["react-dom", "LICENSE"],
    ["scheduler", "LICENSE"],
    ["vite", "LICENSE.md"],
  ].map(
    async ([name, filename]) =>
      `${name}\n${await readFile(join(root, "node_modules", name, filename), "utf8")}`,
  ),
);
files[`${folder}/THIRD-PARTY-NOTICES.txt`] = strToU8(notices.join("\n\n"));
await mkdir(join(root, "release"), { recursive: true });
const output = join(root, "release", `${folder}.zip`);
await writeFile(output, zipSync(files, { level: 9 }));
console.log(output);
