/**
 * ビルド: src/App.svelte を起点に import グラフをたどりながら、
 * 各 .svelte を compile() でJSモジュールに変換して public/ に書き出す。
 * 本家で言うと vite-plugin-svelte が `.svelte` ごとに compile() を呼び、
 * バンドラが import を解決してモジュールグラフを組む部分のミニ版。
 *
 *   node src/lib/build.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, svelte_to_js_filename } from "../compiler/index.ts";

const src_dir = fileURLToPath(new URL("../", import.meta.url));
const out_dir = fileURLToPath(new URL("../../public/", import.meta.url));

await mkdir(out_dir, { recursive: true });

// エントリポイントから import された .svelte を幅優先でたどる。
// seen により同じファイルは一度だけコンパイルする（循環 import でも停止する）
const queue = ["App.svelte"];
const seen = new Set<string>();
const css_chunks: string[] = [];

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

  const out_name = svelte_to_js_filename(filename);
  const out_path = join(out_dir, out_name);
  await mkdir(dirname(out_path), { recursive: true });
  await writeFile(out_path, result.js.code);
  console.log(`src/${filename} -> public/${out_name} を出力しました`);

  if (result.css.code) {
    css_chunks.push(`/* ${filename} */\n${result.css.code}`);
  }

  for (const imported of result.analysis.imports) {
    // analyze が "./" から始まる相対パスであることを保証しているので "./" を剥がすだけでよい
    queue.push(imported.source.slice(2));
  }
}

// 各 .svelte の <style> を結合して1つのCSSファイルに書き出す(本家のようなスコープ処理は行わない)。
// スタイルが1つもなくても書き出すことで、public/index.html の <link> が404にならないようにする
await writeFile(
  join(out_dir, "bundle.css"),
  css_chunks.length > 0 ? `${css_chunks.join("\n\n")}\n` : "",
);
console.log(`public/bundle.css を出力しました(${css_chunks.length} 件のスタイルを結合)`);
