export type Delta = -1 | 1;

/**
 * id の項目を前（-1）または後ろ（+1）の隣と入れ替えた新しい配列を返す（T-017）。
 * 端にある・見つからないときは引数の配列そのものを返すので、呼び出し側は === で「変化なし」を判定できる。
 */
export function moveItem<T extends { id: string }>(
	items: T[],
	id: string,
	delta: Delta,
): T[] {
	const from = items.findIndex((item) => item.id === id);
	const to = from + delta;
	if (from < 0 || to < 0 || to >= items.length) return items;
	const next = items.slice();
	next.splice(to, 0, ...next.splice(from, 1));
	return next;
}
