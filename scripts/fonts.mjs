import { mkdir, copyFile, readdir } from "node:fs/promises";
import path from "node:path";
const families = ["playfair-display", "libre-baskerville", "instrument-serif"];
await mkdir("public/fonts", { recursive: true });
await mkdir("licenses/fonts", { recursive: true });
for (const family of families) {
  const base = path.join("node_modules", "@fontsource", family);
  for (const file of await readdir(path.join(base, "files"))) {
    if (
      file.includes("-latin-") &&
      /-(400|600)-(normal|italic)\.woff2$/.test(file)
    )
      await copyFile(
        path.join(base, "files", file),
        path.join("public/fonts", file),
      );
  }
  await copyFile(
    path.join(base, "LICENSE"),
    path.join("licenses/fonts", family + "-OFL.txt"),
  );
}
console.log("Self-hosted Latin fonts and OFL license notices copied.");
