import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { workerSource } from "./sw-source.mjs";
const assetNames = (
  await readdir(new URL("../dist/assets/", import.meta.url))
).filter((x) => /\.(js|css|woff2)$/.test(x));
const files = [
  "/index.html",
  "/icon.svg",
  "/manifest.webmanifest",
  ...assetNames.map((x) => "/assets/" + x),
];
// Hash every cached file, not only index.html: a deploy that changes just the
// icon or manifest must still produce a new worker so clients update.
const hash = createHash("sha256");
for (const f of files) hash.update(f).update(await readFile(new URL("../dist" + f, import.meta.url)));
const version = hash.digest("hex").slice(0, 16);
const worker = workerSource(files, version);
await writeFile(new URL("../dist/sw.js", import.meta.url), worker);
console.log(
  `App shell prepared (${files.length} public files); API requests excluded.`,
);
