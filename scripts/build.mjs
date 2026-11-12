import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
const result = spawnSync(process.execPath, [viteCli, "build"], {
  cwd: root,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const workerPath = path.join(root, "dist", "sw.js");
const worker = await readFile(workerPath, "utf8");
const cacheDeclaration = /const CACHE = "aimer-v\d+";/;
if (!cacheDeclaration.test(worker)) {
  throw new Error("No se encontró la versión de caché del service worker.");
}

const buildVersion = Date.now();
await writeFile(
  workerPath,
  worker.replace(cacheDeclaration, `const CACHE = "aimer-v${buildVersion}";`),
  "utf8"
);
