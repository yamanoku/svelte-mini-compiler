/**
 * ビルド: src/App.svelte を compile() でJSモジュールに変換し、
 * public/app.js として書き出す。
 * 本家で言うと vite-plugin-svelte が `.svelte` ごとに compile() を呼んで
 * JSモジュールへ変換する部分のミニ版。
 *
 *   node src/build.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { compile } from "./compiler/index.ts";

const input = fileURLToPath(new URL("./App.svelte", import.meta.url));
const out_dir = fileURLToPath(new URL("../public/", import.meta.url));
const output = fileURLToPath(new URL("../public/app.js", import.meta.url));

const source = await readFile(input, "utf8");
const result = compile(source);

for (const warning of result.analysis.warnings) {
  console.warn(
    `警告 [${warning.code}] ${warning.message} (offset ${warning.start}-${warning.end})`,
  );
}

await mkdir(out_dir, { recursive: true });
await writeFile(output, result.js.code);

console.log("src/App.svelte -> public/app.js を出力しました");
