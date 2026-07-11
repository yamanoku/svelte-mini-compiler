/**
 * フェーズ1: パース。
 * 本家の `packages/svelte/src/compiler/phases/1-parse/index.js` のミニ版。
 *
 * Svelteのパーサは正規表現ベースのトークナイザではなく「手書きの再帰下降パーサ」で、
 * 以下の要素で構成される:
 *
 * - `template` と現在位置 `index` を持ち、1文字ずつ読み進める
 * - `stack` に「まだ閉じられていない要素」を積む
 * - `fragment` → `element` / `text` という状態関数を遷移させるステートマシン
 * - `eat` / `match` / `read` / `read_until` などの小さなヘルパー群
 */
import type { Component, Fragment, RegularElement, Root, TemplateNode } from "../../types.ts";
import { CompileError } from "../../errors.ts";
import { fragment } from "./state/fragment.ts";
import { closing_tag_omitted } from "./utils/html.ts";

/**
 * 状態関数。次の状態を返すか、何も返さずデフォルト状態（fragment）に戻る。
 * 本家の `ParserState` と同じ設計。
 */
export type ParserState = (parser: Parser) => ParserState | void;

export class Parser {
  readonly template: string;

  /** 現在の読み取り位置（オフセット） */
  index = 0;

  root: Root;

  /** まだ閉じられていない要素のスタック。先頭は常に Root */
  stack: Array<Root | RegularElement | Component> = [];

  /** stack と対になる、子ノードの追加先 Fragment のスタック */
  fragments: Fragment[] = [];

  constructor(template: string) {
    this.template = template;

    this.root = {
      type: "Root",
      start: 0,
      end: template.length,
      fragment: { type: "Fragment", nodes: [] },
      instance: null,
      css: null,
    };

    this.stack.push(this.root);
    this.fragments.push(this.root.fragment);

    // ステートマシン本体。本家とまったく同じループ:
    //   let state = fragment;
    //   while (this.index < this.template.length) state = state(this) || fragment;
    let state: ParserState = fragment;
    while (this.index < this.template.length) {
      state = state(this) ?? fragment;
    }

    // ソース終端に達した時点で閉じられていない要素の処理。
    // 終了タグの省略が許される要素（li, p など）は暗黙的に閉じ、それ以外はエラー
    while (this.stack.length > 1) {
      const element = this.current() as RegularElement | Component;
      if (!closing_tag_omitted(element.name)) {
        this.error(`<${element.name}> が閉じられていません`, element.start);
      }
      element.end = this.template.length;
      this.pop();
    }
  }

  /** 現在開いている（＝スタックの先頭の）要素 */
  current(): Root | RegularElement | Component {
    return this.stack[this.stack.length - 1];
  }

  /** 現在のFragmentにノードを追加する */
  append(node: TemplateNode): void {
    this.fragments[this.fragments.length - 1].nodes.push(node);
  }

  /** 要素を開く: スタックに積み、以降の子はこの要素のFragmentに入る */
  push(element: RegularElement | Component): void {
    this.append(element);
    this.stack.push(element);
    this.fragments.push(element.fragment);
  }

  /** 要素を閉じる */
  pop(): void {
    this.stack.pop();
    this.fragments.pop();
  }

  /** 現在位置が str で始まるか（読み進めない） */
  match(str: string): boolean {
    return this.template.startsWith(str, this.index);
  }

  /** 現在位置が str で始まれば読み進めて true。required なら失敗時にエラー */
  eat(str: string, required = false, message?: string): boolean {
    if (this.match(str)) {
      this.index += str.length;
      return true;
    }
    if (required) {
      this.error(message ?? `"${str}" が必要です`);
    }
    return false;
  }

  /** 現在位置から正規表現でマッチを試みる（読み進めない） */
  match_regex(pattern: RegExp): string | null {
    const match = pattern.exec(this.template.slice(this.index));
    if (!match || match.index !== 0) return null;
    return match[0];
  }

  /** 現在位置から正規表現でマッチした分を読み進めて返す */
  read(pattern: RegExp): string | null {
    const result = this.match_regex(pattern);
    if (result) this.index += result.length;
    return result;
  }

  /** pattern にマッチする直前までを読み進めて返す（マッチしなければ終端まで） */
  read_until(pattern: RegExp): string {
    if (this.index >= this.template.length) {
      this.error("テンプレートが途中で終了しました");
    }
    const start = this.index;
    const match = pattern.exec(this.template.slice(start));
    if (match) {
      this.index = start + match.index;
      return this.template.slice(start, this.index);
    }
    this.index = this.template.length;
    return this.template.slice(start);
  }

  /** 空白があれば読み飛ばす */
  allow_whitespace(): void {
    while (this.index < this.template.length && /\s/.test(this.template[this.index])) {
      this.index += 1;
    }
  }

  /** 行・列を算出して位置情報つきのエラーを投げる */
  error(message: string, index = this.index): never {
    throw new CompileError(message, this.template, index);
  }
}

/**
 * パースのエントリポイント。本家の `parse(template)` に相当。
 */
export function parse(template: string): Root {
  const parser = new Parser(template);
  return parser.root;
}
