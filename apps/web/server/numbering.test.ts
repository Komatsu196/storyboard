import { describe, expect, it } from "vitest";
import {
	duplicateNumber,
	nextNumber,
	nextPosition,
	sameIdSet,
} from "./numbering";

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

describe("duplicateNumber", () => {
	it("appends -2 to the source number", () => {
		expect(duplicateNumber("3", ["1", "2", "3", "4"])).toBe("3-2");
		expect(duplicateNumber("2A", ["2A"])).toBe("2A-2");
	});

	it("picks the smallest unused suffix", () => {
		expect(duplicateNumber("3", ["3", "3-2"])).toBe("3-3");
		expect(duplicateNumber("3", ["3", "3-3"])).toBe("3-2");
	});

	it("strips a trailing -digits from the source before counting", () => {
		expect(duplicateNumber("3-2", ["3", "3-2"])).toBe("3-3");
		expect(duplicateNumber("3-2", ["3-2"])).toBe("3-3");
	});

	it("compares the siblings trimmed", () => {
		expect(duplicateNumber(" 3 ", ["3", " 3-2 "])).toBe("3-3");
	});

	it("keeps the source number when the result would exceed 20 characters", () => {
		const long = "1234567890123456789";
		expect(duplicateNumber(long, [long])).toBe(long);
		expect(duplicateNumber("123456789012345678", ["123456789012345678"])).toBe(
			"123456789012345678-2",
		);
	});
});
