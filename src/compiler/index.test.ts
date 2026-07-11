import assert from "node:assert/strict";
import { test } from "node:test";
import { compile } from "./index.ts";

test("compile() は parse → analyze → transform の結果をまとめて返す", () => {
  const result = compile('<div class="box"><img src="a.png">hello</div>');

  // 1. parse
  assert.equal(result.ast.type, "Root");
  assert.equal(result.ast.fragment.nodes[0].type, "RegularElement");

  // 2. analyze
  assert.deepEqual(result.analysis.element_counts, { div: 1, img: 1 });
  assert.equal(result.analysis.max_depth, 2);
  assert.equal(result.analysis.warnings[0].code, "a11y_missing_attribute");

  // 3. transform
  assert.match(result.js.code, /document\.createElement\("div"\)/);
  assert.match(result.js.code, /setAttribute\("class", "box"\)/);
  assert.match(result.js.code, /createTextNode\("hello"\)/);
  assert.match(result.js.code, /target\.appendChild\(div_1\);/);
});

test("id の重複は警告になる", () => {
  const result = compile('<div id="a"></div><p id="a"></p>');
  assert.equal(result.analysis.warnings[0].code, "duplicate_id");
});

test(".svelte の import はコンポーネント呼び出しつきのJSモジュールにコンパイルされる", () => {
  const source = [
    "<script>",
    '\timport Profile from "./Profile.svelte";',
    "</script>",
    "",
    "<main>",
    "\t<Profile />",
    "</main>",
    "",
  ].join("\n");

  const result = compile(source, { filename: "App.svelte" });

  // import は .svelte → .js に書き換えられる
  assert.match(result.js.code, /^import Profile from "\.\/Profile\.js";$/m);
  // コンポーネント関数は filename 由来の名前で default export される
  assert.match(result.js.code, /export default function App\(target\) \{/);
  // コンポーネントタグは関数呼び出しになる
  assert.match(result.js.code, /Profile\(main_1\);/);
});

test("filename 未指定のときのコンポーネント関数名は Component になる", () => {
  const result = compile("<p>hi</p>");
  assert.match(result.js.code, /export default function Component\(target\) \{/);
});
