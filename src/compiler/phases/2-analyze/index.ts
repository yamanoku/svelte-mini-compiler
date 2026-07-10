/**
 * フェーズ2: 解析。
 * 本家の `packages/svelte/src/compiler/phases/2-analyze/index.js` のミニ版。
 *
 * 本家はここでASTをwalkしてスコープ解決・リアクティビティ解析・a11y警告などを行い、
 * その結果（analysis）を3-transformに渡す。
 * ここでは要素の統計と、本家のa11y警告のミニ版をいくつか実装する。
 */
import type { Analysis, Fragment, RegularElement, Root, Warning } from "../../types.ts";

export function analyze(ast: Root): Analysis {
  const element_counts: Record<string, number> = {};
  const warnings: Warning[] = [];
  const seen_ids = new Set<string>();
  let max_depth = 0;

  function get_attribute(element: RegularElement, name: string) {
    return element.attributes.find((attribute) => attribute.name === name);
  }

  function visit_fragment(fragment: Fragment, depth: number): void {
    for (const node of fragment.nodes) {
      if (node.type !== "RegularElement") continue;

      element_counts[node.name] = (element_counts[node.name] ?? 0) + 1;
      max_depth = Math.max(max_depth, depth);

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

  return { element_counts, max_depth, warnings };
}
