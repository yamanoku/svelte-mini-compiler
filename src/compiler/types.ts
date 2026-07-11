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

/** ルート直下の `<script>`。本家の `AST.Root.instance`（instance script）に相当。
 * 本家はJSのAST（estree）を持つが、ここでは生のソース文字列のみ保持する */
export interface Script extends BaseNode {
  type: "Script";
  content: string;
}

/** ルート直下の `<style>`。本家の `AST.Root.css`（スタイルシート）に相当。
 * 本家はCSSのAST（postcss-safe-parserベース）を持つが、ここでは生のソース文字列のみ保持する */
export interface Style extends BaseNode {
  type: "Style";
  content: string;
}

/** ASTのルート。本家の `AST.Root` に相当 */
export interface Root extends BaseNode {
  type: "Root";
  fragment: Fragment;
  /** ルート直下の `<script>`（なければ null）。本家の instance script に相当 */
  instance: Script | null;
  /** ルート直下の `<style>`（なければ null） */
  css: Style | null;
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

/** 大文字始まりのタグ（`<Profile />` など）。本家の `AST.Component` に相当 */
export interface Component extends BaseNode {
  type: "Component";
  name: string;
  attributes: Attribute[];
  fragment: Fragment;
}

export type TemplateNode = Text | Comment | RegularElement | Component;

/** 2-analyze フェーズの出力 */
export interface Warning {
  code: string;
  message: string;
  start: number;
  end: number;
}

/** instance script から抽出した `.svelte` の import 情報 */
export interface ComponentImport {
  /** import されるコンポーネント名（例: "Profile"） */
  name: string;
  /** import 元のパス（例: "./Profile.svelte"） */
  source: string;
  start: number;
  end: number;
}

export interface Analysis {
  /** 要素名・コンポーネント名ごとの出現数 */
  element_counts: Record<string, number>;
  /** 要素の最大ネスト深さ */
  max_depth: number;
  warnings: Warning[];
  /** instance script から抽出した import の一覧 */
  imports: ComponentImport[];
}

/** compile() のオプション。本家の `CompileOptions` のミニ版 */
export interface CompileOptions {
  /** コンポーネント関数名の元になるファイル名（例: "App.svelte"）。本家の options.filename に相当 */
  filename?: string;
}

/** compile() の戻り値。本家の `CompileResult`（js/css/warnings/ast）のミニ版 */
export interface CompileResult {
  ast: Root;
  analysis: Analysis;
  js: {
    code: string;
  };
  css: {
    code: string;
  };
}
