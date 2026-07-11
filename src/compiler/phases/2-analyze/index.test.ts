import assert from "node:assert/strict";
import { test } from "node:test";
import { CompileError } from "../../errors.ts";
import { parse } from "../1-parse/index.ts";
import { analyze } from "./index.ts";

/** parse → analyze をまとめて実行するテスト用ヘルパー */
function analyze_source(source: string) {
  return analyze(parse(source), source);
}

test("instance script から import を抽出する", () => {
  const source = '<script>\n\timport Profile from "./Profile.svelte";\n</script>\n<Profile />';
  const analysis = analyze_source(source);

  assert.deepEqual(
    analysis.imports.map(({ name, source: import_source }) => ({ name, source: import_source })),
    [{ name: "Profile", source: "./Profile.svelte" }],
  );
  assert.equal(analysis.element_counts.Profile, 1);
});

test("import されていないコンポーネントの使用はエラーになる", () => {
  assert.throws(() => analyze_source("<main><Profile /></main>"), CompileError);
});

test("使用されていない import は unused_import 警告になる", () => {
  const source = '<script>\n\timport Profile from "./Profile.svelte";\n</script>\n<main></main>';
  const analysis = analyze_source(source);

  assert.equal(analysis.warnings[0].code, "unused_import");
});

test("コンポーネントへの属性（props）はエラーになる", () => {
  const source =
    '<script>\n\timport Profile from "./Profile.svelte";\n</script>\n<Profile name="a" />';
  assert.throws(() => analyze_source(source), CompileError);
});

test("コンポーネントの子要素（slot）はエラーになる。空白のみの子は許容", () => {
  const script = '<script>\n\timport Profile from "./Profile.svelte";\n</script>\n';

  assert.throws(() => analyze_source(`${script}<Profile><b>x</b></Profile>`), CompileError);

  // 改行・インデントだけなら子要素とはみなさない
  const analysis = analyze_source(`${script}<Profile>\n</Profile>`);
  assert.equal(analysis.element_counts.Profile, 1);
});

test("import 元は './' から始まる相対 .svelte パスのみ許可される（'../' によるトラバーサルは拒否）", () => {
  for (const source_path of ["../Evil.svelte", "Profile.svelte", "./profile.js"]) {
    const source = `<script>\n\timport Profile from "${source_path}";\n</script>\n<Profile />`;
    assert.throws(() => analyze_source(source), CompileError, source_path);
  }
});

test("import 元はサブディレクトリの .svelte も許可される", () => {
  const source =
    '<script>\n\timport Profile from "./components/Profile.svelte";\n</script>\n<Profile />';
  const analysis = analyze_source(source);

  assert.deepEqual(
    analysis.imports.map(({ name, source: import_source }) => ({ name, source: import_source })),
    [{ name: "Profile", source: "./components/Profile.svelte" }],
  );
});

test("import 名が小文字始まり・重複はエラーになる", () => {
  assert.throws(
    () => analyze_source('<script>\n\timport profile from "./Profile.svelte";\n</script>'),
    CompileError,
  );
  assert.throws(
    () =>
      analyze_source(
        '<script>\n\timport Profile from "./Profile.svelte";\n\timport Profile from "./Card.svelte";\n</script>',
      ),
    CompileError,
  );
});

test("<script> 内の import 文以外のコードはエラーになる", () => {
  assert.throws(() => analyze_source("<script>\n\tconst count = 1;\n</script>"), CompileError);
});
