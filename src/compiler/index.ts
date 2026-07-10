/**
 * コンパイラのエントリポイント。
 * 本家の `packages/svelte/src/compiler/index.js` の `compile()` と同じく、
 * 3つのフェーズを順番に実行するだけの薄い関数:
 *
 *   1. parse     — ソース文字列 → AST
 *   2. analyze   — AST → 解析結果（統計・警告）
 *   3. transform — AST + 解析結果 → JSコード
 */
import type { CompileResult } from './types.ts';
import { parse } from './phases/1-parse/index.ts';
import { analyze } from './phases/2-analyze/index.ts';
import { transform } from './phases/3-transform/index.ts';

export function compile(source: string): CompileResult {
	const ast = parse(source);
	const analysis = analyze(ast);
	const js = transform(ast, analysis);

	return { ast, analysis, js };
}

export { parse, analyze, transform };
export { CompileError } from './errors.ts';
export type * from './types.ts';
