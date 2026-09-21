export type History<T> = {
	readonly past: readonly T[];
	readonly present: T;
	readonly future: readonly T[];
};

export const HISTORY_LIMIT = 100;

export function createHistory<T>(present: T): History<T> {
	return { past: [], present, future: [] };
}

/** 新しい状態を積む。future は捨て、past は limit 件まで残す */
export function push<T>(
	h: History<T>,
	next: T,
	limit = HISTORY_LIMIT,
): History<T> {
	const past = [...h.past, h.present];
	return {
		past: past.length > limit ? past.slice(past.length - limit) : past,
		present: next,
		future: [],
	};
}

export function undo<T>(h: History<T>): History<T> {
	if (h.past.length === 0) return h;
	return {
		past: h.past.slice(0, -1),
		present: h.past[h.past.length - 1],
		future: [h.present, ...h.future],
	};
}

export function redo<T>(h: History<T>): History<T> {
	if (h.future.length === 0) return h;
	return {
		past: [...h.past, h.present],
		present: h.future[0],
		future: h.future.slice(1),
	};
}

export const canUndo = <T>(h: History<T>): boolean => h.past.length > 0;
export const canRedo = <T>(h: History<T>): boolean => h.future.length > 0;
