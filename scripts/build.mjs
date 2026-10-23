import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.join(root, "dist");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const file of ["index.html", "styles.css", "src", "assets"]) {
  await cp(path.join(root, file), path.join(out, file), { recursive: true });
}
await writeFile(path.join(out, ".nojekyll"), "");
console.log(
  "Built static site in dist/ (no dependencies or network required).",
);
