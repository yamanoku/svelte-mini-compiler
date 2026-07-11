/**
 * ビルド: src/App.svelte を起点に import グラフをたどりながら、
 * 各 .svelte を compile() でJSモジュールに変換して public/ に書き出す。
 * 本家で言うと vite-plugin-svelte が `.svelte` ごとに compile() を呼び、
 * バンドラが import を解決してモジュールグラフを組む部分のミニ版。
 *
 *   node src/build.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./compiler/index.ts";

const src_dir = fileURLToPath(new URL("./", import.meta.url));
const out_dir = fileURLToPath(new URL("../public/", import.meta.url));

await mkdir(out_dir, { recursive: true });

// エントリポイントから import された .svelte を幅優先でたどる。
// seen により同じファイルは一度だけコンパイルする（循環 import でも停止する）
const queue = ["App.svelte"];
const seen = new Set<string>();

while (queue.length > 0) {
  const filename = queue.shift()!;
  if (seen.has(filename)) continue;
  seen.add(filename);

  let source: string;
  try {
    source = await readFile(join(src_dir, filename), "utf8");
  } catch {
    console.error(`エラー: import された ./${filename} が src/ に見つかりません`);
    process.exit(1);
  }

  const result = compile(source, { filename });

  for (const warning of result.analysis.warnings) {
    console.warn(
      `警告 [${filename}] [${warning.code}] ${warning.message} (offset ${warning.start}-${warning.end})`,
    );
  }

  const out_name = filename.replace(/\.svelte$/, ".js");
  await writeFile(join(out_dir, out_name), result.js.code);
  console.log(`src/${filename} -> public/${out_name} を出力しました`);

  for (const imported of result.analysis.imports) {
    // analyze が "./Name.svelte" 形式を保証しているので "./" を剥がすだけでよい
    queue.push(imported.source.slice(2));
  }
}
