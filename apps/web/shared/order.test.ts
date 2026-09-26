import { describe, expect, it } from "vitest";
import { moveItem } from "./order";

const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("moveItem", () => {
	it("swaps with the previous or the next item", () => {
		expect(ids(moveItem(items, "b", -1))).toEqual(["b", "a", "c"]);
		expect(ids(moveItem(items, "b", 1))).toEqual(["a", "c", "b"]);
		expect(ids(moveItem(items, "a", 1))).toEqual(["b", "a", "c"]);
		expect(ids(moveItem(items, "c", -1))).toEqual(["a", "c", "b"]);
	});

	it("returns the same array at the ends or for an unknown id", () => {
		expect(moveItem(items, "a", -1)).toBe(items);
		expect(moveItem(items, "c", 1)).toBe(items);
		expect(moveItem(items, "x", 1)).toBe(items);
	});

	it("does not mutate the input", () => {
		moveItem(items, "b", -1);
		expect(ids(items)).toEqual(["a", "b", "c"]);
	});
});
