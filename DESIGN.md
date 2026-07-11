# 設計に関するドキュメント

## パーサの仕組み（本家から借りている設計）

Svelteのパーサは字句解析と構文解析を分けず、**現在位置 `index` を進めながらASTを直接組み立てる**スタイルです。核になるのは次の3つです。

### 1. 状態関数のループ

```ts
let state: ParserState = fragment;
while (this.index < this.template.length) {
  state = state(this) ?? fragment;
}
```

`fragment` は次の文字を見て `element` か `text` を返すディスパッチャで、各状態関数は処理を終えると `fragment` に戻ります。本家の `Parser` コンストラクタとまったく同じループです。

### 2. 小さなヘルパー群

`eat(str)` / `match(str)` / `read(regex)` / `read_until(regex)` / `allow_whitespace()` という数個のヘルパーだけでパーサ全体が書かれています。たとえば属性の読み取りは:

```ts
const name = parser.read(regex_attribute_name);
if (parser.eat("=")) {
  value = read_attribute_value(parser);
}
```

### 3. スタックによる開いている要素の管理

`<div>` を読むと `stack` に積み、以降の子ノードはその要素の `fragment` に入ります。`</div>` で pop します。この仕組みの上で、HTML特有の挙動も再現しています:

- **void要素** (`<br>`, `<img>` …) はスタックに積まない
- **終了タグの省略**: `<li>りんご<li>みかん` は `closing_tag_omitted()`（本家と同名の関数）の判定で1つ目の `li` を暗黙的に閉じる
- **`<script>` / `<style>`** の中身はHTMLとして解析せず、終了タグまで生テキストとして読む。**ルート直下の `<script>`** はテンプレートの一部ではなく instance script として `Root.instance` に取り出す（本家の `read_script` に相当）
- **大文字始まりのタグ**（`<Profile />`）は `RegularElement` ではなく `Component` ノードになる（本家の component 分岐に相当）

すべてのASTノードは `start` / `end` のソースオフセットを持ち、エラーはオフセットから行・列を計算して報告します（本家の `CompileError` と同じ）。

## コンポーネントの import と合成

`.svelte` ファイルの中で別の `.svelte` を import してコンポーネントとして呼び出せます:

```svelte
<script>
	import Profile from "./Profile.svelte";
</script>

<main>
	<Profile />
</main>
```

- parse がルート直下の `<script>` を `Root.instance` に、`<Profile />` を `Component` ノードにする
- analyze が instance script から import を抽出し（本家は acorn でJSをパースするが、ここでは行単位の正規表現）、未 import のコンポーネント使用をエラーに、未使用の import を警告にする（本家のスコープ解決のミニ版）
- transform が import を `./Profile.svelte` → `./Profile.js` に書き換えて出力し、コンポーネントタグを関数呼び出し `Profile(parent)` に変換する。モジュールはコンポーネント関数を default export する（本家と同じ形）
- build（`src/build.ts`）がエントリの `App.svelte` から import グラフをたどり、各ファイルを個別のJSモジュールにコンパイルする（本家で言う vite-plugin-svelte + バンドラの解決）

## 本家との違い（簡略化した点）

- mustache構文（`{expression}` / `{#if}` …）・`bind:` などのディレクティブは非対応。HTMLのみ
- コンポーネントは「呼び出し」のみ対応。props（属性）・子要素（slot）・`<svelte:component>` は非対応
- `<script>` に書けるのは同一ディレクトリの `.svelte` の default import 文のみ（それ以外のコードはコンパイルエラー）
- 相互 import（A→B→A）はビルドは通るが、実行時に無限再帰する
- analyze はスコープ解決やリアクティビティ解析を持たず、統計とa11y警告と import 抽出のミニ版のみ
- transform はリアクティビティのない素朴な `document.createElement` の羅列を生成（本家はテンプレートのクローンと signal ベースの更新コードを生成する）
- 文字参照テーブルは代表的なもののみ（本家は全named entityを持つ）
