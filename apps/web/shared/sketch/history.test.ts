import { describe, expect, it } from "vitest";
import { canRedo, canUndo, createHistory, push, redo, undo } from "./history";

describe("history", () => {
	it("pushes, undoes and redoes", () => {
		let h = createHistory("a");
		h = push(h, "b");
		h = push(h, "c");
		expect(h.present).toBe("c");
		expect(canUndo(h)).toBe(true);
		expect(canRedo(h)).toBe(false);
		h = undo(h);
		expect(h.present).toBe("b");
		expect(canRedo(h)).toBe(true);
		h = undo(h);
		expect(h.present).toBe("a");
		expect(canUndo(h)).toBe(false);
		h = redo(h);
		expect(h.present).toBe("b");
	});

	it("discards the redo stack when pushing after an undo", () => {
		let h = push(push(createHistory("a"), "b"), "c");
		h = undo(h);
		h = push(h, "d");
		expect(h.present).toBe("d");
		expect(canRedo(h)).toBe(false);
		expect(undo(h).present).toBe("b");
	});

	it("returns the same object when there is nothing to undo or redo", () => {
		const h = createHistory("a");
		expect(undo(h)).toBe(h);
		expect(redo(h)).toBe(h);
	});

	it("keeps at most `limit` past entries", () => {
		let h = createHistory(0);
		for (let i = 1; i <= 101; i++) h = push(h, i);
		expect(h.past).toHaveLength(100);
		for (let i = 0; i < 100; i++) h = undo(h);
		expect(h.present).toBe(1); // 最古の 0 は落ちている
		expect(canUndo(h)).toBe(false);
	});
});
