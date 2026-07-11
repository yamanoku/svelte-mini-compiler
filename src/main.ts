/**
 * デモ: サンプルHTMLをコンパイルして各フェーズの出力を表示する。
 *
 *   node src/main.ts
 */
import { inspect } from "node:util";
import { compile } from "./compiler/index.ts";

const source = `<script>
	import Profile from "./Profile.svelte";
</script>

<!-- プロフィールページ -->
<section class="card" id="page" data-theme='dark'>
	<h1>yamanoku&#39;s page</h1>
	<img src="avatar.png">
	<p>1つ目の段落（終了タグ省略）
	<p>2つ目の段落 &amp; エンティティ</p>
	<ul>
		<li>りんご
		<li>みかん
	</ul>
	<input type="text" disabled>
	<br />
	<Profile />
</section>
`;

const result = compile(source, { filename: "Demo.svelte" });

console.log("=== ソース ===");
console.log(source);

console.log("=== 1. parse: AST ===");
console.log(inspect(result.ast, { depth: null, colors: true }));

console.log("\n=== 2. analyze: 解析結果 ===");
console.log("要素の出現数:", result.analysis.element_counts);
console.log("最大ネスト深さ:", result.analysis.max_depth);
console.log("import:", result.analysis.imports);
for (const warning of result.analysis.warnings) {
  console.log(`警告 [${warning.code}] ${warning.message} (offset ${warning.start}-${warning.end})`);
}

console.log("\n=== 3. transform: 生成されたJSコード ===");
console.log(result.js.code);
