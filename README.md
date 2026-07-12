# svelte-mini-compiler

> [!WARNING]
> このプロジェクトはSvelteのコンパイラの仕組みを理解する目的のためプロダクション開発で扱う想定のものではありません

[sveltejs/svelte](https://github.com/sveltejs/svelte) の `compile()` の仕組みを参考にした、HTMLの描画にフォーカスした擬似コンパイラです。

Svelteのコンパイラは **parse → analyze → transform** の3フェーズで構成されています。

このサンプルは、その構造とパーサの実装スタイル（手書きの再帰下降パーサ + ステートマシン）をHTMLだけを対象に小さく再現したものです。

## コンパイル出力結果のデモ

以下コマンドにて、svelte-mini-compilerでコンパイルした結果を出力します。

```sh
pnpm install
pnpm demo
```

## ブラウザで描画するまでのフロー

`.svelte` ファイルを `compile()` でビルドしてJSモジュールを出力し、それを `index.html` から読み込んでブラウザに描画するまでの一連のフローも試せます。

```sh
pnpm serve
# -> http://localhost:3000 を開く
```

1. `src/lib/build.ts` がエントリの `src/App.svelte` から import グラフをたどり、各 `.svelte` を `compile()` でJSモジュール（コンポーネント関数を default export）に変換して `public/App.js` / `public/Profile.js` に書き出す（本家で言う vite-plugin-svelte + バンドラのミニ版。analyze フェーズの警告もここで表示される）
2. `src/lib/serve.ts`（`node:http` 製の最小静的サーバー）が `public/` を配信する
3. `public/index.html` が `<script type="module">` で `./App.js` を import し、`App(document.getElementById("app"))` を呼んでDOMを構築する。`App.js` は `./Profile.js` を import してコンポーネントを合成する

`.svelte` の中で別の `.svelte` を import すると `<Profile />` のようにコンポーネントとして呼び出せます（props / 子要素は未対応。詳細は [DESIGN.md](./DESIGN.md)）。

ビルドだけ行う場合は `pnpm build:app` を実行してください。

## 本家Svelteとの対応表

| このサンプル                                    | 本家 (`packages/svelte/src/compiler/`) | 役割                                                                                      |
| ----------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/compiler/index.ts`                         | `index.js` の `compile()`              | 3フェーズを順に実行するエントリポイント                                                   |
| `src/compiler/phases/1-parse/index.ts`          | `phases/1-parse/index.js` の `Parser`  | 手書き再帰下降パーサ本体（`index`/`stack`/状態関数ループ）                                |
| `src/compiler/phases/1-parse/state/fragment.ts` | `phases/1-parse/state/fragment.js`     | 次のトークンを見て状態を振り分ける（本家は `{` → mustache にも分岐）                      |
| `src/compiler/phases/1-parse/state/element.ts`  | `phases/1-parse/state/element.js`      | タグ・属性・終了タグ省略・`<script>` 特別扱い                                             |
| `src/compiler/phases/1-parse/state/text.ts`     | `phases/1-parse/state/text.js`         | テキストノード                                                                            |
| `src/compiler/phases/1-parse/utils/html.ts`     | `phases/1-parse/utils/html.js` ほか    | void要素・終了タグ省略表・文字参照デコード                                                |
| `src/compiler/phases/2-analyze/index.ts`        | `phases/2-analyze/index.js`            | ASTのwalkと警告収集・import解決（本家はスコープ解決・リアクティビティ解析・a11yチェック） |
| `src/compiler/phases/3-transform/index.ts`      | `phases/3-transform/client/`           | ASTからJSコード文字列を生成（本家はテンプレートクローン+リアクティブ更新コード）          |
| `Root.instance`（ルート直下の `<script>`）      | `AST.Root.instance`                    | instance script。ここから `.svelte` の import を抽出する                                  |
| `Component` ノード（大文字始まりのタグ）        | `AST.Component`                        | コンポーネントタグ。生成コードでは関数呼び出しになる                                      |
| `src/lib/build.ts`                              | vite-plugin-svelte + バンドラ          | import グラフをたどって各 `.svelte` をJSモジュールに変換する                              |
| `src/compiler/types.ts`                         | `types/template.d.ts`                  | ASTノード型（`Root` / `Fragment` / `RegularElement` …）                                   |
| `src/compiler/errors.ts`                        | `errors.js` の `CompileError`          | 位置情報つきコンパイルエラー                                                              |
