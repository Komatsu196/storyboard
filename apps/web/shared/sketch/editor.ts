import { createHistory, type History, push, redo, undo } from "./history";
import { strokesHitByEraser } from "./hitTest";
import { ERASER_RADIUS, MAX_STROKES, type Stroke } from "./types";

export type EditorState = {
	history: History<Stroke[]>;
	/** 消しゴム中の作業用配列。触れたストロークをここから除き、離したときに履歴へ積む（T-012） */
	working: Stroke[] | null;
};

export type EditorAction =
	| { type: "stroke"; stroke: Stroke }
	| { type: "erase"; segment: number[] }
	| { type: "eraseEnd" }
	| { type: "eraseCancel" }
	| { type: "undo" }
	| { type: "redo" }
	| { type: "clear" };

export function createEditorState(strokes: Stroke[]): EditorState {
	return { history: createHistory(strokes), working: null };
}

/** 表示用のストローク（消しゴム中は作業用配列） */
export function currentStrokes(state: EditorState): Stroke[] {
	return state.working ?? state.history.present;
}

/** 変化がなければ同じ state を返す（React の再描画を抑える） */
export function reduceEditor(
	state: EditorState,
	action: EditorAction,
): EditorState {
	const { history } = state;
	switch (action.type) {
		case "stroke": {
			if (state.working || history.present.length >= MAX_STROKES) return state;
			return {
				history: push(history, [...history.present, action.stroke]),
				working: null,
			};
		}
		case "erase": {
			const base = state.working ?? history.present;
			const hits = strokesHitByEraser(base, action.segment, ERASER_RADIUS);
			if (hits.length === 0) return state;
			const hitSet = new Set(hits);
			return { history, working: base.filter((_, i) => !hitSet.has(i)) };
		}
		case "eraseEnd":
			return state.working
				? { history: push(history, state.working), working: null }
				: state;
		case "eraseCancel":
			return state.working ? { history, working: null } : state;
		case "undo": {
			const next = undo(history);
			if (next === history && state.working === null) return state;
			return { history: next, working: null };
		}
		case "redo": {
			const next = redo(history);
			if (next === history && state.working === null) return state;
			return { history: next, working: null };
		}
		case "clear":
			if (history.present.length === 0 && state.working === null) return state;
			return { history: push(history, []), working: null };
	}
}
