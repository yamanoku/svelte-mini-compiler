/**
 * 要素（タグ）の状態関数。パーサの中で最も複雑な部分。
 * 本家の `phases/1-parse/state/element.js` に相当。
 *
 * `<` を読んだ直後に呼ばれ、コメント / doctype / 終了タグ / 開始タグを判別し、
 * 開始タグなら属性を読み取って要素ノードを組み立てる。
 */
import type { Attribute, Component, RegularElement } from "../../../types.ts";
import type { Parser } from "../index.ts";
import {
  closing_tag_omitted,
  decode_character_references,
  is_raw_text_element,
  is_void,
} from "../utils/html.ts";

const regex_element_name = /^[a-zA-Z][a-zA-Z0-9-]*/;
const regex_attribute_name = /^[^\s=/>"']+/;
const regex_unquoted_attribute_value = /^[^\s>]+/;

/** コンポーネント名はJSの識別子として妥当である必要がある（生成コードで関数呼び出しになるため） */
const regex_component_name = /^[A-Z][A-Za-z0-9_$]*$/;

export function element(parser: Parser): void {
  const start = parser.index;
  parser.eat("<", true);

  // コメント <!-- ... -->
  if (parser.eat("!--")) {
    const data = parser.read_until(/-->/);
    parser.eat("-->", true, "コメントが閉じられていません");
    parser.append({ type: "Comment", start, end: parser.index, data });
    return;
  }

  // doctype宣言はASTに残さず読み飛ばす
  if (parser.match_regex(/^!doctype/i)) {
    parser.read_until(/>/);
    parser.eat(">", true);
    return;
  }

  // 終了タグ </name>
  if (parser.eat("/")) {
    const name = parser.read(regex_element_name);
    if (!name) parser.error("終了タグの要素名が必要です");
    parser.allow_whitespace();
    parser.eat(">", true);
    close_element(parser, name, start);
    return;
  }

  const name = parser.read(regex_element_name);
  if (!name) parser.error("要素名が必要です");

  // 大文字始まりのタグはコンポーネント（本家 element.js の component 分岐に相当）
  const is_component = /^[A-Z]/.test(name);
  if (is_component && !regex_component_name.test(name)) {
    parser.error(`コンポーネント名 <${name}> に使えるのは英数字・_・$ のみです`, start);
  }

  // 終了タグの省略: 開いている要素がこのタグの出現で暗黙的に閉じられるケース
  // （例: <li>りんご<li> → 1つ目の li をここで閉じる）
  const parent = parser.current();
  if (parent.type === "RegularElement" && closing_tag_omitted(parent.name, name)) {
    parent.end = start;
    parser.pop();
  }

  const element: RegularElement | Component = is_component
    ? {
        type: "Component",
        start,
        end: -1, // タグを閉じたときに確定する
        name,
        attributes: [],
        fragment: { type: "Fragment", nodes: [] },
      }
    : {
        type: "RegularElement",
        start,
        end: -1,
        name,
        attributes: [],
        fragment: { type: "Fragment", nodes: [] },
      };

  // 属性の読み取り。`>` か `/` が来るまで繰り返す
  parser.allow_whitespace();
  while (!parser.match(">") && !parser.match("/")) {
    if (parser.index >= parser.template.length) {
      parser.error(`<${name}> のタグが閉じられていません`, start);
    }
    element.attributes.push(read_attribute(parser));
    parser.allow_whitespace();
  }

  const self_closing = parser.eat("/");
  parser.eat(">", true);

  // 自己終了タグ・void要素は子を持たないのでスタックに積まない
  if (self_closing || (!is_component && is_void(name))) {
    element.end = parser.index;
    parser.append(element);
    return;
  }

  // <script> / <style> / <textarea> の中身はHTMLとして解析せず、
  // 対応する終了タグまでを1つのテキストノードとして読む（本家と同じ特別扱い）
  if (!is_component && is_raw_text_element(name)) {
    const data_start = parser.index;
    const data = parser.read_until(new RegExp(`</${name}\\s*>`, "i"));
    parser.eat(`</${name}`, true, `</${name}> が必要です`);
    parser.allow_whitespace();
    parser.eat(">", true);
    element.end = parser.index;

    // ルート直下の <script> はテンプレートの一部ではなく instance script として
    // Root.instance に取り出す（本家が read_script で Root.instance を作るのに相当）
    if (name === "script" && parser.current().type === "Root") {
      if (parser.root.instance) {
        parser.error("<script> はコンポーネントに1つだけ書けます", start);
      }
      parser.root.instance = { type: "Script", start, end: parser.index, content: data };
      return;
    }

    element.fragment.nodes.push({
      type: "Text",
      start: data_start,
      end: data_start + data.length,
      raw: data,
      data,
    });
    parser.append(element);
    return;
  }

  parser.push(element);
}

/**
 * 終了タグの処理。スタックを遡って対応する開始タグを探す。
 * 途中の要素は、終了タグの省略が許されるものであれば暗黙的に閉じる
 * （例: <ul><li>りんご</ul> の </ul> は li も閉じる）。
 */
function close_element(parser: Parser, name: string, start: number): void {
  while (true) {
    const current = parser.current();

    if (current.type === "Root") {
      parser.error(`</${name}> に対応する開始タグがありません`, start);
    }

    if (current.name === name) {
      current.end = parser.index;
      parser.pop();
      return;
    }

    if (!closing_tag_omitted(current.name)) {
      parser.error(
        `</${name}> が現れましたが、先に <${current.name}> を閉じる必要があります`,
        start,
      );
    }

    current.end = start;
    parser.pop();
  }
}

function read_attribute(parser: Parser): Attribute {
  const start = parser.index;

  const name = parser.read(regex_attribute_name);
  if (!name) parser.error("属性名が必要です");

  let value: string | true = true;
  let end = parser.index;

  // `name = value` のように = の前後に空白があっても許容する
  const before_whitespace = parser.index;
  parser.allow_whitespace();
  if (parser.eat("=")) {
    parser.allow_whitespace();
    value = read_attribute_value(parser);
    end = parser.index;
  } else {
    // = がなければboolean属性。読み飛ばした空白は次の属性のために戻す
    parser.index = before_whitespace;
  }

  return { type: "Attribute", start, end, name, value };
}

function read_attribute_value(parser: Parser): string {
  const quote_mark = parser.eat('"') ? '"' : parser.eat("'") ? "'" : null;

  if (quote_mark) {
    const value = parser.read_until(new RegExp(quote_mark));
    parser.eat(quote_mark, true, "属性値の引用符が閉じられていません");
    return decode_character_references(value);
  }

  const value = parser.read(regex_unquoted_attribute_value);
  if (!value) parser.error("属性値が必要です");
  return decode_character_references(value);
}
