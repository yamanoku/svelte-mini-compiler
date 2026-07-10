/**
 * テキストノードの状態関数。
 * 本家の `phases/1-parse/state/text.js` に相当
 * （本家は `<` と `{` の両方で停止するが、HTMLだけを扱うここでは `<` のみ）。
 */
import type { Parser } from '../index.ts';
import { decode_character_references } from '../utils/html.ts';

export function text(parser: Parser): void {
	const start = parser.index;
	const raw = parser.read_until(/</);

	parser.append({
		type: 'Text',
		start,
		end: parser.index,
		raw,
		data: decode_character_references(raw)
	});
}
