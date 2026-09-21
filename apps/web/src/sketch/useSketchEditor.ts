import { useCallback, useMemo, useReducer, useState } from "react";
import {
	createEditorState,
	currentStrokes,
	reduceEditor,
} from "../../shared/sketch/editor";
import { canRedo, canUndo } from "../../shared/sketch/history";
import type {
	SketchData,
	Stroke,
	StrokeColor,
	StrokeSize,
} from "../../shared/sketch/types";

export type Tool = {
	mode: "pen" | "eraser";
	color: StrokeColor;
	size: StrokeSize;
};

// 選択中のツールは SPA を開いている間だけ保持する（カットを移っても変わらない。保存はしない。T-013）
let lastTool: Tool = { mode: "pen", color: "black", size: 2 };

export function useSketchEditor(initial: SketchData) {
	const [state, dispatch] = useReducer(
		reduceEditor,
		initial.strokes,
		createEditorState,
	);
	const [tool, setToolState] = useState<Tool>(lastTool);
	const setTool = useCallback((next: Tool) => {
		lastTool = next;
		setToolState(next);
	}, []);

	const { w, h } = initial;
	const present = state.history.present;
	// 保存対象（履歴の現在値）。消しゴム中の作業用配列は含めない（T-012）
	const committed = useMemo<SketchData>(
		() => ({ v: 1, w, h, strokes: present }),
		[w, h, present],
	);
	// 表示用（消しゴム中は作業用配列）
	const visible = currentStrokes(state);
	const sketch = useMemo<SketchData>(
		() => (visible === present ? committed : { v: 1, w, h, strokes: visible }),
		[w, h, visible, present, committed],
	);

	return {
		sketch,
		committed,
		tool,
		setTool,
		canUndo: canUndo(state.history),
		canRedo: canRedo(state.history),
		undo: () => dispatch({ type: "undo" }),
		redo: () => dispatch({ type: "redo" }),
		clear: () => dispatch({ type: "clear" }),
		addStroke: (stroke: Stroke) => dispatch({ type: "stroke", stroke }),
		erase: (segment: number[]) => dispatch({ type: "erase", segment }),
		endErase: () => dispatch({ type: "eraseEnd" }),
		cancelErase: () => dispatch({ type: "eraseCancel" }),
	};
}
