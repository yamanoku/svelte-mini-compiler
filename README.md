# svelte-mini-compiler

[sveltejs/svelte](https://github.com/sveltejs/svelte) の `compile()` の仕組みを参考にした、HTML解析のみを行うコンパイラのサンプルです。

Svelteのコンパイラは **parse → analyze → transform** の3フェーズで構成されています。

このサンプルは、その構造とパーサの実装スタイル（手書きの再帰下降パーサ + ステートマシン）をHTMLだけを対象に小さく再現したものです。

## 実行方法

```sh
pnpm install
pnpm demo
```

## 本家Svelteとの対応表

| このサンプル | 本家 (`packages/svelte/src/compiler/`) | 役割 |
| --- | --- | --- |
| `src/compiler/index.ts` | `index.js` の `compile()` | 3フェーズを順に実行するエントリポイント |
| `src/compiler/phases/1-parse/index.ts` | `phases/1-parse/index.js` の `Parser` | 手書き再帰下降パーサ本体（`index`/`stack`/状態関数ループ） |
| `src/compiler/phases/1-parse/state/fragment.ts` | `phases/1-parse/state/fragment.js` | 次のトークンを見て状態を振り分ける（本家は `{` → mustache にも分岐） |
| `src/compiler/phases/1-parse/state/element.ts` | `phases/1-parse/state/element.js` | タグ・属性・終了タグ省略・`<script>` 特別扱い |
| `src/compiler/phases/1-parse/state/text.ts` | `phases/1-parse/state/text.js` | テキストノード |
| `src/compiler/phases/1-parse/utils/html.ts` | `phases/1-parse/utils/html.js` ほか | void要素・終了タグ省略表・文字参照デコード |
| `src/compiler/phases/2-analyze/index.ts` | `phases/2-analyze/index.js` | ASTのwalkと警告収集（本家はスコープ解決・リアクティビティ解析・a11yチェック） |
| `src/compiler/phases/3-transform/index.ts` | `phases/3-transform/client/` | ASTからJSコード文字列を生成（本家はテンプレートクローン+リアクティブ更新コード） |
| `src/compiler/types.ts` | `types/template.d.ts` | ASTノード型（`Root` / `Fragment` / `RegularElement` …） |
| `src/compiler/errors.ts` | `errors.js` の `CompileError` | 位置情報つきコンパイルエラー |

