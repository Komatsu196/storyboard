import { describe, expect, it } from "vitest";
import { nextNumber, nextPosition, sameIdSet } from "./numbering";

describe("nextNumber", () => {
	it("uses the largest leading integer + 1", () => {
		expect(nextNumber(["1", "2", "2A", "3"])).toBe("4");
		expect(nextNumber(["10", "9"])).toBe("11");
		expect(nextNumber(["2A", "2B"])).toBe("3");
	});

	it("starts at 1 when no number has a leading integer", () => {
		expect(nextNumber([])).toBe("1");
		expect(nextNumber(["A", "B"])).toBe("1");
	});

	it("ignores leading zeros and whitespace", () => {
		expect(nextNumber(["007", " 3"])).toBe("8");
	});
});

describe("nextPosition", () => {
	it("is 0 for the first sibling and max + 1 afterwards", () => {
		expect(nextPosition([])).toBe(0);
		expect(nextPosition([0, 1, 2])).toBe(3);
		expect(nextPosition([5])).toBe(6);
	});
});

describe("sameIdSet", () => {
	it("is true when the ids are exactly the current siblings in any order", () => {
		expect(sameIdSet(["b", "a"], ["a", "b"])).toBe(true);
		expect(sameIdSet([], [])).toBe(true);
	});

	it("is false when an id is missing, extra, foreign or duplicated", () => {
		expect(sameIdSet(["a"], ["a", "b"])).toBe(false);
		expect(sameIdSet(["a", "b", "c"], ["a", "b"])).toBe(false);
		expect(sameIdSet(["a", "x"], ["a", "b"])).toBe(false);
		expect(sameIdSet(["a", "a"], ["a", "b"])).toBe(false);
	});
});
