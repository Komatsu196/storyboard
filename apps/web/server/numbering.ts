/** 兄弟の number の先頭整数部分の最大値 + 1（整数が 1 つもなければ 1）を文字列で返す（設計書 §3.3） */
export function nextNumber(existing: readonly string[]): string {
	let max = 0;
	for (const n of existing) {
		const m = /^\d+/.exec(n.trim());
		if (m) max = Math.max(max, Number.parseInt(m[0], 10));
	}
	return String(max + 1);
}

/** 兄弟の position の最大値 + 1（兄弟なしなら 0） */
export function nextPosition(existing: readonly number[]): number {
	return existing.length === 0 ? 0 : Math.max(...existing) + 1;
}

/** 並べ替えの ids が今の兄弟とちょうど同じ集合か（過不足・他の親の ID・重複があれば false。設計書 §4） */
export function sameIdSet(
	ids: readonly string[],
	current: readonly string[],
): boolean {
	const set = new Set(ids);
	if (set.size !== ids.length || ids.length !== current.length) return false;
	return current.every((id) => set.has(id));
}

/** number の入力の上限（shared/schemas の番号と同じ） */
const NUMBER_MAX = 20;

/**
 * 複製したカット・シーンの番号（T-033）。末尾の「-数字」を外した土台に -2, -3… を付け、兄弟で使われていない最小のものを返す。
 * 上限の文字数を超えるときは元の番号のまま（後で 7 項目まとめて保存するとき検証で弾かれないように）
 */
export function duplicateNumber(
	source: string,
	siblings: readonly string[],
): string {
	const base = source.trim().replace(/-\d+$/, "");
	const used = new Set(siblings.map((n) => n.trim()));
	let k = 2;
	while (used.has(`${base}-${k}`)) k++;
	const next = `${base}-${k}`;
	return next.length > NUMBER_MAX ? source.trim() : next;
}
