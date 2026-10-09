#!/usr/bin/env node
/**
 * Nitro inlines PGLite into the server function but leaves its sibling
 * wasm/data files behind. The bundled module loads them via import.meta.url,
 * so they have to sit next to `_libs/electric-sql__pglite.mjs`.
 */
import { access, copyFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "node_modules/@electric-sql/pglite/dist");
const destDir = join(root, ".vercel/output/functions/__server.func/_libs");
const files = ["pglite.wasm", "pglite.data", "initdb.wasm"];

try {
  await access(destDir);
} catch {
  console.log("[pglite] no server bundle — skip");
  process.exit(0);
}

for (const name of files) {
  await copyFile(join(srcDir, name), join(destDir, name));
  console.log("[pglite] copied", name);
}
