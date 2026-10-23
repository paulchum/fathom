import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".json": "application/json",
};
const server = http.createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      return res.end();
    }
    const url = new URL(req.url, "http://localhost");
    const relative =
      decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    // This preview serves only the public build inputs, never repository metadata.
    if (
      !["index.html", "styles.css"].includes(relative) &&
      !/^(src|assets)\/[a-zA-Z0-9_./-]+$/.test(relative)
    )
      throw new Error("Not public");
    const target = path.resolve(root, relative);
    if (
      !target.startsWith(root) ||
      relative.split("/").some((p) => p.startsWith("."))
    )
      throw new Error("Not public");
    if (!(await stat(target)).isFile()) throw new Error("Not a file");
    const content = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(req.method === "HEAD" ? undefined : content);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`FATHOM ready at http://127.0.0.1:${port}`),
);
