import { describe, expect, it } from "vitest";
import { simplifyPoints } from "./simplify";

describe("simplifyPoints", () => {
	it("keeps a single point and a two-point stroke as is", () => {
		expect(simplifyPoints([5, 5])).toEqual([5, 5]);
		expect(simplifyPoints([0, 0, 100, 0])).toEqual([0, 0, 100, 0]);
	});

	it("drops points closer than minDist to the last kept point", () => {
		expect(simplifyPoints([0, 0, 1, 0, 2, 0, 5, 0], 3)).toEqual([0, 0, 5, 0]);
		expect(simplifyPoints([0, 0, 3, 0, 4, 0, 7, 0], 3)).toEqual([
			0, 0, 3, 0, 7, 0,
		]);
	});

	it("always keeps the end point, without duplicating it", () => {
		expect(simplifyPoints([0, 0, 10, 0, 11, 0], 3)).toEqual([
			0, 0, 10, 0, 11, 0,
		]);
		expect(simplifyPoints([0, 0, 10, 0, 10, 0], 3)).toEqual([0, 0, 10, 0]);
	});

	it("does not mutate the input", () => {
		const p = [0, 0, 1, 0, 9, 0];
		simplifyPoints(p);
		expect(p).toEqual([0, 0, 1, 0, 9, 0]);
	});
});
