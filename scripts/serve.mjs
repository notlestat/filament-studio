import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../dist/", import.meta.url));
const requestedPort = Number(process.env.PORT ?? 5180);
if (
  !Number.isInteger(requestedPort) ||
  requestedPort < 0 ||
  requestedPort > 65535
) {
  console.error("PORT must be a number between 0 and 65535.");
  process.exit(1);
}
try {
  await stat(resolve(root, "index.html"));
} catch {
  console.error(
    "The built app is missing. Run npm run build, or download the local-use ZIP.",
  );
  process.exit(1);
}

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};
const server = createServer(async (request, response) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", "no-cache");
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, "http://localhost").pathname,
    );
    const path = resolve(
      root,
      pathname === "/" ? "index.html" : `.${pathname}`,
    );
    if (!path.startsWith(root.endsWith(sep) ? root : root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    const bytes = await readFile(path);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(path)] ?? "application/octet-stream",
      "Content-Length": bytes.length,
    });
    response.end(request.method === "HEAD" ? undefined : bytes);
  } catch (error) {
    const status =
      error instanceof URIError
        ? 400
        : ["ENOENT", "EISDIR", "ENOTDIR"].includes(error.code)
          ? 404
          : 500;
    response
      .writeHead(status)
      .end(status === 404 ? "Not found" : "Request failed");
  }
});
let port = requestedPort;
server.on("error", (error) => {
  if (
    error.code === "EADDRINUSE" &&
    port < Math.min(requestedPort + 10, 65535)
  ) {
    server.listen(++port, "127.0.0.1");
    return;
  }
  console.error(`Could not start Filament Studio: ${error.message}`);
  process.exit(1);
});
server.on("listening", () => {
  console.log(`Filament Studio: http://127.0.0.1:${server.address().port}/`);
  console.log(
    "Open this address in your browser. Keep this terminal open. Press Ctrl+C to stop.",
  );
});
server.listen(port, "127.0.0.1");
