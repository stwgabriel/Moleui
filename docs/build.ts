import { mkdir, readdir, writeFile } from "node:fs/promises";

const entries = await readdir(new URL(".", import.meta.url), { withFileTypes: true });
const docs = entries
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .sort();

await mkdir("dist", { recursive: true });
await writeFile("dist/index.json", `${JSON.stringify({ docs }, null, 2)}\n`);
