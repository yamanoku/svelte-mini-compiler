/**
 * デフォルトの状態関数。次に何が来るかを見て適切な状態に振り分ける。
 * 本家の `phases/1-parse/state/fragment.js` に相当
 * （本家はここでさらに `{` → tag（マスタッシュ構文）にも分岐する）。
 */
import type { Parser, ParserState } from '../index.ts';
import { element } from './element.ts';
import { text } from './text.ts';

export function fragment(parser: Parser): ParserState {
	if (parser.match('<')) {
		return element;
	}
	return text;
}
