/**
 * フェーズ3: 変換（コード生成）。
 * 本家の `packages/svelte/src/compiler/phases/3-transform/client/` のミニ版。
 *
 * 本家はASTからクライアント用のJSモジュール（テンプレートのクローンと
 * リアクティブな更新処理）を生成する。ここではそのミニ版として、
 * ASTをDOM構築コード（document.createElement の羅列）に変換した
 * コンポーネント関数を default export するJSモジュール文字列を生成する。
 *
 * instance script から抽出された `.svelte` の import は、コンパイル済みの
 * `.js` への import に書き換えて出力する（本家では vite-plugin-svelte などの
 * バンドラ側が行う解決に相当）。コンポーネントタグは、import した
 * コンポーネント関数の呼び出し `Profile(parent)` になる。
 *
 * ルート直下の `<style>`（`Root.css`）はDOM構築コードには含めず、
 * `css.code` として別出力する（本家の `CompileResult.css` に相当。
 * スコープ処理はせず、生のCSSをそのまま返すだけのミニ版）。
 */
import type { Analysis, CompileOptions, Fragment, Root } from "../../types.ts";

/** `.svelte` のファイル名（例: "App.svelte"）をコンパイル後の `.js` のファイル名に変換する */
export function svelte_to_js_filename(filename: string): string {
  return filename.replace(/\.svelte$/, ".js");
}

/** filename（例: "App.svelte"）から生成するコンポーネント関数名を導出する。本家と同じ発想 */
function component_name_from_filename(filename: string | undefined): string {
  const base =
    filename
      ?.split("/")
      .pop()
      ?.replace(/\.svelte$/, "") ?? "";
  return /^[A-Za-z_$][\w$]*$/.test(base) ? base : "Component";
}

export function transform(
  ast: Root,
  analysis: Analysis,
  options: CompileOptions = {},
): { js: { code: string }; css: { code: string } } {
  const body: string[] = [];
  const counters: Record<string, number> = {};

  /** `div_1`, `text_2` のような一意な変数名を採番する（本家のscope.generateに相当） */
  function generate_name(base: string): string {
    const sanitized = base.replace(/-/g, "_");
    counters[sanitized] = (counters[sanitized] ?? 0) + 1;
    return `${sanitized}_${counters[sanitized]}`;
  }

  function visit_fragment(fragment: Fragment, parent_name: string, indent: string): void {
    for (const node of fragment.nodes) {
      if (node.type === "Comment") continue;

      if (node.type === "Text") {
        // 空白のみのテキストのうち、改行を含むもの（要素間のインデント等）は出力せず、
        // 改行を含まないもの（インライン要素間の区切りスペース）は半角スペース1つに畳んで出力する
        let data = node.data;
        if (data.trim() === "") {
          if (data.includes("\n")) continue;
          data = " ";
        }
        const name = generate_name("text");
        body.push(`${indent}const ${name} = document.createTextNode(${JSON.stringify(data)});`);
        body.push(`${indent}${parent_name}.appendChild(${name});`);
        continue;
      }

      // コンポーネントは import されたコンポーネント関数の呼び出しになる
      if (node.type === "Component") {
        body.push(`${indent}${node.name}(${parent_name});`);
        continue;
      }

      const name = generate_name(node.name);
      body.push(`${indent}const ${name} = document.createElement(${JSON.stringify(node.name)});`);

      for (const attribute of node.attributes) {
        const value = attribute.value === true ? "" : attribute.value;
        body.push(
          `${indent}${name}.setAttribute(${JSON.stringify(attribute.name)}, ${JSON.stringify(value)});`,
        );
      }

      visit_fragment(node.fragment, name, indent);
      body.push(`${indent}${parent_name}.appendChild(${name});`);
    }
  }

  visit_fragment(ast.fragment, "target", "\t");

  const total = Object.values(analysis.element_counts).reduce((a, b) => a + b, 0);
  const component_name = component_name_from_filename(options.filename);

  // `./Profile.svelte` → `./Profile.js` に書き換えた import 行
  const import_lines = analysis.imports.map(
    (imported) =>
      `import ${imported.name} from ${JSON.stringify(svelte_to_js_filename(imported.source))};`,
  );

  const code = [
    `// このコードは svelte-mini-compiler によって生成されました（要素数: ${total}）`,
    ...(import_lines.length > 0 ? [...import_lines, ""] : []),
    `export default function ${component_name}(target) {`,
    ...body,
    "}",
    "",
  ].join("\n");

  return { js: { code }, css: { code: ast.css ? ast.css.content.trim() : "" } };
}
