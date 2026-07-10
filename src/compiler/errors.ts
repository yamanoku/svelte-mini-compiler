/**
 * 位置情報つきのコンパイルエラー。
 * 本家の `packages/svelte/src/compiler/errors.js`（`CompileError`）のミニ版。
 * オフセットから行・列を算出してメッセージに含める。
 */
export class CompileError extends Error {
  readonly position: number;
  readonly line: number;
  readonly column: number;

  constructor(message: string, template: string, position: number) {
    const consumed = template.slice(0, position).split("\n");
    const line = consumed.length;
    const column = consumed[consumed.length - 1].length + 1;

    super(`${message} (${line}:${column})`);
    this.name = "CompileError";
    this.position = position;
    this.line = line;
    this.column = column;
  }
}
