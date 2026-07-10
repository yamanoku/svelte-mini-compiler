/**
 * ASTノードの型定義。
 * 本家 Svelte の `packages/svelte/src/compiler/types/template.d.ts`
 * （`AST.Root` / `AST.Fragment` / `AST.RegularElement` など）のミニ版。
 */

/** すべてのノードはソース上のオフセット（start/end）を持つ。本家と同じ方式 */
export interface BaseNode {
  type: string;
  start: number;
  end: number;
}

/** 子ノードの並び。Root と各要素が1つずつ持つ */
export interface Fragment {
  type: "Fragment";
  nodes: TemplateNode[];
}

/** ASTのルート。本家の `AST.Root` に相当 */
export interface Root extends BaseNode {
  type: "Root";
  fragment: Fragment;
}

export interface Text extends BaseNode {
  type: "Text";
  /** ソースに書かれたままのテキスト */
  raw: string;
  /** 文字参照（&amp; など）をデコードしたテキスト */
  data: string;
}

/** `<!-- ... -->` */
export interface Comment extends BaseNode {
  type: "Comment";
  data: string;
}

export interface Attribute extends BaseNode {
  type: "Attribute";
  name: string;
  /** boolean属性（`disabled` など値のないもの）は true */
  value: string | true;
}

/** 通常のHTML要素。本家の `AST.RegularElement` に相当 */
export interface RegularElement extends BaseNode {
  type: "RegularElement";
  name: string;
  attributes: Attribute[];
  fragment: Fragment;
}

export type TemplateNode = Text | Comment | RegularElement;

/** 2-analyze フェーズの出力 */
export interface Warning {
  code: string;
  message: string;
  start: number;
  end: number;
}

export interface Analysis {
  /** 要素名ごとの出現数 */
  element_counts: Record<string, number>;
  /** 要素の最大ネスト深さ */
  max_depth: number;
  warnings: Warning[];
}

/** compile() の戻り値。本家の `CompileResult`（js/css/warnings/ast）のミニ版 */
export interface CompileResult {
  ast: Root;
  analysis: Analysis;
  js: {
    code: string;
  };
}
