/**
 * フェーズ3: 変換（コード生成）。
 * 本家の `packages/svelte/src/compiler/phases/3-transform/client/` のミニ版。
 *
 * 本家はASTからクライアント用のJSモジュール（テンプレートのクローンと
 * リアクティブな更新処理）を生成する。ここではそのミニ版として、
 * ASTをDOM構築コード（document.createElement の羅列）に変換した
 * `render(target)` 関数を持つJSモジュール文字列を生成する。
 */
import type { Analysis, Fragment, Root } from '../../types.ts';

export function transform(ast: Root, analysis: Analysis): { code: string } {
	const body: string[] = [];
	const counters: Record<string, number> = {};

	/** `div_1`, `text_2` のような一意な変数名を採番する（本家のscope.generateに相当） */
	function generate_name(base: string): string {
		const sanitized = base.replace(/-/g, '_');
		counters[sanitized] = (counters[sanitized] ?? 0) + 1;
		return `${sanitized}_${counters[sanitized]}`;
	}

	function visit_fragment(fragment: Fragment, parent_name: string, indent: string): void {
		for (const node of fragment.nodes) {
			if (node.type === 'Comment') continue;

			if (node.type === 'Text') {
				// 要素間のインデント等、空白のみのテキストは出力しない
				if (node.data.trim() === '') continue;
				const name = generate_name('text');
				body.push(`${indent}const ${name} = document.createTextNode(${JSON.stringify(node.data)});`);
				body.push(`${indent}${parent_name}.appendChild(${name});`);
				continue;
			}

			const name = generate_name(node.name);
			body.push(`${indent}const ${name} = document.createElement(${JSON.stringify(node.name)});`);

			for (const attribute of node.attributes) {
				const value = attribute.value === true ? '' : attribute.value;
				body.push(
					`${indent}${name}.setAttribute(${JSON.stringify(attribute.name)}, ${JSON.stringify(value)});`
				);
			}

			visit_fragment(node.fragment, name, indent);
			body.push(`${indent}${parent_name}.appendChild(${name});`);
		}
	}

	visit_fragment(ast.fragment, 'target', '\t');

	const total = Object.values(analysis.element_counts).reduce((a, b) => a + b, 0);

	const code = [
		`// このコードは svelte-compiler-html によって生成されました（要素数: ${total}）`,
		'export function render(target) {',
		...body,
		'}',
		''
	].join('\n');

	return { code };
}
