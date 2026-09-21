import { describe, expect, it } from "vitest";
import { createEditorState, currentStrokes, reduceEditor } from "./editor";
import { canUndo } from "./history";
import { MAX_STROKES, type Stroke } from "./types";

const stroke = (p: number[]): Stroke => ({ color: "black", size: 2, p });
const a = stroke([0, 0, 100, 0]);
const b = stroke([0, 500, 100, 500]);

describe("reduceEditor", () => {
	it("appends a stroke as one history entry", () => {
		let s = createEditorState([]);
		s = reduceEditor(s, { type: "stroke", stroke: a });
		expect(currentStrokes(s)).toEqual([a]);
		expect(canUndo(s.history)).toBe(true);
		expect(currentStrokes(reduceEditor(s, { type: "undo" }))).toEqual([]);
	});

	it("ignores strokes beyond MAX_STROKES", () => {
		const full = createEditorState(
			Array.from({ length: MAX_STROKES }, () => a),
		);
		expect(reduceEditor(full, { type: "stroke", stroke: b })).toBe(full);
	});

	it("erases touched strokes immediately and commits them as one entry on eraseEnd", () => {
		let s = createEditorState([a, b]);
		s = reduceEditor(s, { type: "erase", segment: [50, -5, 50, 5] }); // a に触れる
		expect(currentStrokes(s)).toEqual([b]);
		expect(s.history.present).toEqual([a, b]); // 履歴はまだ進まない
		s = reduceEditor(s, { type: "erase", segment: [50, 495, 50, 505] }); // b にも触れる
		expect(currentStrokes(s)).toEqual([]);
		s = reduceEditor(s, { type: "eraseEnd" });
		expect(s.working).toBeNull();
		expect(s.history.present).toEqual([]);
		// 一筆ぶんは 1 回の undo で戻る（T-012）
		expect(currentStrokes(reduceEditor(s, { type: "undo" }))).toEqual([a, b]);
	});

	it("returns the same state when the eraser touches nothing", () => {
		const s = createEditorState([a]);
		expect(
			reduceEditor(s, { type: "erase", segment: [50, 300, 50, 310] }),
		).toBe(s);
		expect(reduceEditor(s, { type: "eraseEnd" })).toBe(s);
	});

	it("restores the strokes on eraseCancel", () => {
		let s = createEditorState([a]);
		s = reduceEditor(s, { type: "erase", segment: [50, -5, 50, 5] });
		s = reduceEditor(s, { type: "eraseCancel" });
		expect(currentStrokes(s)).toEqual([a]);
		expect(canUndo(s.history)).toBe(false);
	});

	it("clears everything as an undoable entry", () => {
		let s = createEditorState([a, b]);
		s = reduceEditor(s, { type: "clear" });
		expect(currentStrokes(s)).toEqual([]);
		expect(currentStrokes(reduceEditor(s, { type: "undo" }))).toEqual([a, b]);
		const empty = createEditorState([]);
		expect(reduceEditor(empty, { type: "clear" })).toBe(empty);
	});

	it("undo and redo walk the history and are no-ops at the ends", () => {
		const s0 = createEditorState([]);
		expect(reduceEditor(s0, { type: "undo" })).toBe(s0);
		const s1 = reduceEditor(s0, { type: "stroke", stroke: a });
		const s2 = reduceEditor(s1, { type: "undo" });
		expect(currentStrokes(s2)).toEqual([]);
		expect(currentStrokes(reduceEditor(s2, { type: "redo" }))).toEqual([a]);
		expect(reduceEditor(s1, { type: "redo" })).toBe(s1);
	});
});
