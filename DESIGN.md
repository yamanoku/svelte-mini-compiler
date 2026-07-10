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
- **`<script>` / `<style>`** の中身はHTMLとして解析せず、終了タグまで生テキストとして読む

すべてのASTノードは `start` / `end` のソースオフセットを持ち、エラーはオフセットから行・列を計算して報告します（本家の `CompileError` と同じ）。

## 本家との違い（簡略化した点）

- mustache構文（`{expression}` / `{#if}` …）・コンポーネント・`bind:` などのディレクティブは非対応。HTMLのみ
- analyze はスコープ解決やリアクティビティ解析を持たず、統計とa11y警告のミニ版のみ
- transform はリアクティビティのない素朴な `document.createElement` の羅列を生成（本家はテンプレートのクローンと signal ベースの更新コードを生成する）
- 文字参照テーブルは代表的なもののみ（本家は全named entityを持つ）
