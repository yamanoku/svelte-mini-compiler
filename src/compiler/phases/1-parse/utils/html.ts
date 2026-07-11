/**
 * HTML仕様まわりの知識をまとめたユーティリティ。
 * 本家の `packages/svelte/src/compiler/phases/1-parse/utils/html.js` と
 * `utils.js`（is_void）のミニ版。
 */

/** 終了タグを持たないvoid要素 (https://html.spec.whatwg.org/#void-elements) */
const VOID_ELEMENT_NAMES = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function is_void(name: string): boolean {
  return VOID_ELEMENT_NAMES.has(name.toLowerCase());
}

/** 中身をHTMLとして解析しない要素（本家では <script>/<style> を特別扱いしている） */
export function is_raw_text_element(name: string): boolean {
  return name === "script" || name === "style" || name === "textarea";
}

/**
 * 「この要素が開いているときに次のタグが来たら暗黙的に閉じられる」対応表。
 * 例: `<li>りんご<li>みかん` は2つの li になる。
 * 本家の `autoclosing_children` の簡略版。
 */
const implicitly_closed_by: Record<string, string[]> = {
  li: ["li"],
  dt: ["dt", "dd"],
  dd: ["dt", "dd"],
  p: [
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "fieldset",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul",
  ],
  optgroup: ["optgroup"],
  option: ["option", "optgroup"],
  thead: ["tbody", "tfoot"],
  tbody: ["tfoot"],
  tr: ["tr"],
  td: ["td", "th", "tr"],
  th: ["td", "th", "tr"],
};

/**
 * 終了タグの省略が許されるかどうか。
 * 本家の `closing_tag_omitted(current, next)` に相当。
 * `next` が省略された場合は「親の終了タグ or ソースの終端に達した」ことを表す。
 */
export function closing_tag_omitted(current: string, next?: string): boolean {
  const closers = implicitly_closed_by[current];
  if (!closers) return false;
  return next === undefined || closers.includes(next);
}

const named_entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
};

/** コードポイントとして妥当なら対応する文字を、そうでなければ null を返す */
function code_point_to_string(code: number): string | null {
  if (Number.isNaN(code) || code < 0 || code > 0x10ffff) return null;
  return String.fromCodePoint(code);
}

/**
 * 文字参照のデコード。本家の `decode_character_references` のミニ版
 * （本家は全named entityの巨大なテーブルを持つが、ここでは代表的なものだけ）。
 * デコードできない文字参照は原文のまま残す。
 */
export function decode_character_references(html: string): string {
  return html.replace(/&(#?[a-zA-Z0-9]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      return code_point_to_string(parseInt(entity.slice(2), 16)) ?? match;
    }
    if (entity.startsWith("#")) {
      return code_point_to_string(parseInt(entity.slice(1), 10)) ?? match;
    }
    return named_entities[entity] ?? match;
  });
}
