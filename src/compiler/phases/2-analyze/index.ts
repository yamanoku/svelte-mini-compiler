/**
 * フェーズ2: 解析。
 * 本家の `packages/svelte/src/compiler/phases/2-analyze/index.js` のミニ版。
 *
 * 本家はここでASTをwalkしてスコープ解決・リアクティビティ解析・a11y警告などを行い、
 * その結果（analysis）を3-transformに渡す。
 * ここでは要素の統計・本家のa11y警告のミニ版に加えて、instance script（ルート直下の
 * `<script>`）から `.svelte` の import を抽出し、コンポーネントの利用を検証する
 * （本家がスコープ解決で「コンポーネント名 → import 済みの束縛」を解決するのに相当）。
 */
import type {
  Analysis,
  Component,
  ComponentImport,
  Fragment,
  RegularElement,
  Root,
  Warning,
} from "../../types.ts";
import { CompileError } from "../../errors.ts";

/** `import Profile from "./Profile.svelte";` の形にだけマッチする */
const regex_import = /^import\s+([A-Za-z_$][\w$]*)\s+from\s+(["'])(.+?)\2\s*;?$/;

/** import 元は「同一ディレクトリの .svelte」のみ対応（`../` やサブディレクトリは拒否） */
const regex_import_source = /^\.\/[A-Za-z_$][\w$]*\.svelte$/;

export function analyze(ast: Root, source: string): Analysis {
  const element_counts: Record<string, number> = {};
  const warnings: Warning[] = [];
  const seen_ids = new Set<string>();
  let max_depth = 0;

  const imports = extract_imports(ast, source);
  const imported_names = new Set(imports.map((i) => i.name));
  const used_components = new Set<string>();

  function get_attribute(element: RegularElement | Component, name: string) {
    return element.attributes.find((attribute) => attribute.name === name);
  }

  function visit_fragment(fragment: Fragment, depth: number): void {
    for (const node of fragment.nodes) {
      if (node.type !== "Component" && node.type !== "RegularElement") continue;

      // 要素・コンポーネント共通の統計
      element_counts[node.name] = (element_counts[node.name] ?? 0) + 1;
      max_depth = Math.max(max_depth, depth);

      if (node.type === "Component") {
        used_components.add(node.name);

        // 本家ではスコープ解決の結果 `X is not defined` になるケース
        if (!imported_names.has(node.name)) {
          throw new CompileError(
            `コンポーネント <${node.name} /> が <script> で import されていません`,
            source,
            node.start,
          );
        }

        // ミニ版の制限: props / 子要素（slot）は未対応
        if (node.attributes.length > 0) {
          throw new CompileError(
            `コンポーネントは属性（props）に未対応です`,
            source,
            node.attributes[0].start,
          );
        }
        const has_content = node.fragment.nodes.some(
          (child) =>
            !(child.type === "Comment" || (child.type === "Text" && child.data.trim() === "")),
        );
        if (has_content) {
          throw new CompileError(`コンポーネントは子要素（slot）に未対応です`, source, node.start);
        }
        continue;
      }

      // 本家の a11y_missing_attribute 警告のミニ版
      if (node.name === "img" && !get_attribute(node, "alt")) {
        warnings.push({
          code: "a11y_missing_attribute",
          message: "<img> 要素には alt 属性が必要です",
          start: node.start,
          end: node.end,
        });
      }

      if (node.name === "a" && !get_attribute(node, "href")) {
        warnings.push({
          code: "a11y_invalid_anchor",
          message: "<a> 要素には href 属性が必要です",
          start: node.start,
          end: node.end,
        });
      }

      // id の重複チェック
      const id = get_attribute(node, "id");
      if (id && typeof id.value === "string") {
        if (seen_ids.has(id.value)) {
          warnings.push({
            code: "duplicate_id",
            message: `id "${id.value}" が重複しています`,
            start: id.start,
            end: id.end,
          });
        }
        seen_ids.add(id.value);
      }

      visit_fragment(node.fragment, depth + 1);
    }
  }

  visit_fragment(ast.fragment, 1);

  // import されたのにテンプレートで使われていないコンポーネントは警告
  for (const imported of imports) {
    if (!used_components.has(imported.name)) {
      warnings.push({
        code: "unused_import",
        message: `import された "${imported.name}" は使用されていません`,
        start: imported.start,
        end: imported.end,
      });
    }
  }

  return { element_counts, max_depth, warnings, imports };
}

/**
 * instance script の中身から import 文を抽出する。
 * 本家はJSパーサ（acorn）でASTを作るが、ここでは行単位の正規表現で読む。
 */
function extract_imports(ast: Root, source: string): ComponentImport[] {
  if (!ast.instance) return [];

  const imports: ComponentImport[] = [];
  let offset = ast.instance.start;

  for (const line of ast.instance.content.split("\n")) {
    const line_offset = source.indexOf(line, offset);
    const start = line_offset === -1 ? ast.instance.start : line_offset;
    offset = start + line.length;

    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("//")) continue;

    const match = regex_import.exec(trimmed);
    if (!match) {
      throw new CompileError(
        "<script> 内で対応しているのは .svelte ファイルの import 文のみです",
        source,
        start,
      );
    }

    const name = match[1];
    const import_source = match[3];

    if (!regex_import_source.test(import_source)) {
      throw new CompileError(
        `import 元は "./Name.svelte" 形式（同一ディレクトリの .svelte）のみ対応しています`,
        source,
        start,
      );
    }
    if (!/^[A-Z]/.test(name)) {
      throw new CompileError(
        `コンポーネント名は大文字で始める必要があります（"${name}" → "${name[0].toUpperCase()}${name.slice(1)}"）`,
        source,
        start,
      );
    }
    if (imports.some((i) => i.name === name)) {
      throw new CompileError(`"${name}" が重複して import されています`, source, start);
    }

    imports.push({ name, source: import_source, start, end: start + trimmed.length });
  }

  return imports;
}
