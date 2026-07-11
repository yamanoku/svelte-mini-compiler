/**
 * コンパイラのエントリポイント。
 * 本家の `packages/svelte/src/compiler/index.js` の `compile()` と同じく、
 * 3つのフェーズを順番に実行するだけの薄い関数:
 *
 *   1. parse     — ソース文字列 → AST
 *   2. analyze   — AST → 解析結果（統計・警告・import情報）
 *   3. transform — AST + 解析結果 → JSコード / CSSコード
 *
 * 本家と同じく `compile(source, options)` で filename を受け取り、
 * 生成するコンポーネント関数名の導出に使う。
 */
import type { CompileOptions, CompileResult } from "./types.ts";
import { parse } from "./phases/1-parse/index.ts";
import { analyze } from "./phases/2-analyze/index.ts";
import { svelte_to_js_filename, transform } from "./phases/3-transform/index.ts";

export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const ast = parse(source);
  const analysis = analyze(ast, source);
  const { js, css } = transform(ast, analysis, options);

  return { ast, analysis, js, css };
}

export { parse, analyze, transform, svelte_to_js_filename };
export { CompileError } from "./errors.ts";
export type * from "./types.ts";
