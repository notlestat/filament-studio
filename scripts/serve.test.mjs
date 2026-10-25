import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, copyFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

test(
  "local launcher serves built files and keeps the project folder private",
  { timeout: 10000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "filament-serve-"));
    await mkdir(join(directory, "scripts"));
    await mkdir(join(directory, "dist"));
    await copyFile(
      new URL("./serve.mjs", import.meta.url),
      join(directory, "scripts/serve.mjs"),
    );
    await writeFile(join(directory, "dist/index.html"), "<h1>Filament</h1>");
    await writeFile(
      join(directory, "dist/worker.js"),
      "self.postMessage('ready')",
    );
    await writeFile(join(directory, ".env"), "private fixture");
    const child = spawn(
      process.execPath,
      [join(directory, "scripts/serve.mjs")],
      { env: { ...process.env, PORT: "0" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    try {
      const [line] = await once(
        createInterface({ input: child.stdout }),
        "line",
      );
      const url = line.match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
      assert.ok(url, line);
      await t.test(
        "HTML and worker modules have usable content types",
        async () => {
          const html = await fetch(url);
          assert.equal(html.status, 200);
          assert.match(html.headers.get("content-type"), /text\/html/);
          assert.match(await html.text(), /Filament/);
          const worker = await fetch(new URL("worker.js", url));
          assert.match(worker.headers.get("content-type"), /text\/javascript/);
          assert.equal(worker.headers.get("x-content-type-options"), "nosniff");
        },
      );
      await t.test("HEAD succeeds and unsupported methods fail", async () => {
        const head = await fetch(url, { method: "HEAD" });
        assert.equal(head.status, 200);
        assert.equal(await head.text(), "");
        const post = await fetch(url, { method: "POST" });
        assert.equal(post.status, 405);
      });
      await t.test(
        "missing files, malformed URLs, and traversal cannot expose files outside dist",
        async () => {
          assert.equal((await fetch(new URL(".env", url))).status, 404);
          assert.equal(
            (await fetch(new URL("%2e%2e%2f.env", url))).status,
            403,
          );
          assert.equal((await fetch(new URL("%E0%A4%A", url))).status, 400);
        },
      );
    } finally {
      const closed = once(child, "close");
      child.kill();
      await closed;
      await rm(directory, { recursive: true, force: true });
    }
  },
);
