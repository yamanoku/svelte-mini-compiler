import assert from "node:assert/strict";
import { test } from "node:test";
import type { Component, RegularElement, Text } from "../../types.ts";
import { CompileError } from "../../errors.ts";
import { parse } from "./index.ts";

test("基本的なネストした要素とテキストをパースできる", () => {
  const ast = parse("<div><span>hello</span></div>");

  const div = ast.fragment.nodes[0] as RegularElement;
  assert.equal(div.type, "RegularElement");
  assert.equal(div.name, "div");
  assert.equal(div.start, 0);
  assert.equal(div.end, 29);

  const span = div.fragment.nodes[0] as RegularElement;
  assert.equal(span.name, "span");

  const text = span.fragment.nodes[0] as Text;
  assert.equal(text.type, "Text");
  assert.equal(text.data, "hello");
});

test("属性: 引用符あり・引用符なし・boolean属性", () => {
  const ast = parse(`<input type="text" tabindex=1 disabled>`);

  const input = ast.fragment.nodes[0] as RegularElement;
  assert.deepEqual(
    input.attributes.map(({ name, value }) => ({ name, value })),
    [
      { name: "type", value: "text" },
      { name: "tabindex", value: "1" },
      { name: "disabled", value: true },
    ],
  );
});

test("void要素は終了タグなしで閉じ、後続を子として取り込まない", () => {
  const ast = parse('<div><br><img src="a.png"><span>x</span></div>');

  const div = ast.fragment.nodes[0] as RegularElement;
  const names = div.fragment.nodes
    .filter((node) => node.type === "RegularElement")
    .map((node) => node.name);
  assert.deepEqual(names, ["br", "img", "span"]);

  const br = div.fragment.nodes[0] as RegularElement;
  assert.equal(br.fragment.nodes.length, 0);
});

test("終了タグの省略: <li> は次の <li> や </ul> で暗黙的に閉じる", () => {
  const ast = parse("<ul><li>りんご<li>みかん</ul>");

  const ul = ast.fragment.nodes[0] as RegularElement;
  const items = ul.fragment.nodes as RegularElement[];
  assert.equal(items.length, 2);
  assert.equal(items[0].name, "li");
  assert.equal(items[1].name, "li");
  assert.equal((items[0].fragment.nodes[0] as Text).data, "りんご");
  assert.equal((items[1].fragment.nodes[0] as Text).data, "みかん");
});

test("コメントノードをパースできる", () => {
  const ast = parse("<!-- こんにちは -->");

  const comment = ast.fragment.nodes[0];
  assert.equal(comment.type, "Comment");
  assert.equal(comment.data, " こんにちは ");
});

test("文字参照をデコードする（rawには元の文字列が残る）", () => {
  const ast = parse("<p>A &amp; B &#x1F600;</p>");

  const p = ast.fragment.nodes[0] as RegularElement;
  const text = p.fragment.nodes[0] as Text;
  assert.equal(text.raw, "A &amp; B &#x1F600;");
  assert.equal(text.data, "A & B 😀");
});

test("<script> の中身はHTMLとして解析されない", () => {
  const ast = parse('<div><script>if (a < b) console.log("<div>");</script></div>');

  const div = ast.fragment.nodes[0] as RegularElement;
  const script = div.fragment.nodes[0] as RegularElement;
  assert.equal(script.name, "script");
  assert.equal(script.fragment.nodes.length, 1);
  assert.equal((script.fragment.nodes[0] as Text).raw, 'if (a < b) console.log("<div>");');
});

test("ルート直下の <script> は Root.instance になり、fragment には現れない", () => {
  const ast = parse('<script>\n\timport Profile from "./Profile.svelte";\n</script>\n<main></main>');

  assert.ok(ast.instance);
  assert.equal(ast.instance.type, "Script");
  assert.match(ast.instance.content, /import Profile from "\.\/Profile\.svelte";/);

  const names = ast.fragment.nodes
    .filter((node) => node.type === "RegularElement")
    .map((node) => node.name);
  assert.deepEqual(names, ["main"]);
});

test("<script> を2つ書くとエラーになる", () => {
  assert.throws(
    () => parse("<script>a</script><script>b</script>"),
    CompileError,
  );
});

test("大文字始まりのタグは Component ノードになる", () => {
  const ast = parse("<div><Profile /></div><Card></Card>");

  const div = ast.fragment.nodes[0] as RegularElement;
  const profile = div.fragment.nodes[0] as Component;
  assert.equal(profile.type, "Component");
  assert.equal(profile.name, "Profile");
  assert.equal(profile.fragment.nodes.length, 0);

  const card = ast.fragment.nodes[1] as Component;
  assert.equal(card.type, "Component");
  assert.equal(card.name, "Card");
});

test("JS識別子として不正なコンポーネント名はエラーになる", () => {
  assert.throws(() => parse("<Foo-Bar />"), CompileError);
});

test("閉じられていない要素は位置情報つきのエラーになる", () => {
  assert.throws(
    () => parse("<main>\n\t<div>hello\n"),
    (error: unknown) => {
      assert.ok(error instanceof CompileError);
      // エラー位置は閉じられていない <div> の開始位置を指す
      assert.equal(error.line, 2);
      assert.equal(error.column, 2);
      return true;
    },
  );
});

test("対応する開始タグのない終了タグはエラーになる", () => {
  assert.throws(() => parse("<div></span></div>"), CompileError);
});
