import { describe, expect, it } from "vitest";
import { strokesHitByEraser } from "./hitTest";
import type { Stroke } from "./types";

const stroke = (p: number[]): Stroke => ({ color: "black", size: 2, p });

describe("strokesHitByEraser", () => {
	it("hits a stroke within the radius of a single eraser point", () => {
		expect(
			strokesHitByEraser([stroke([100, 100, 200, 100])], [150, 110], 16),
		).toEqual([0]);
	});

	it("treats the radius as inclusive", () => {
		const s = [stroke([100, 100, 200, 100])];
		expect(strokesHitByEraser(s, [150, 116], 16)).toEqual([0]);
		expect(strokesHitByEraser(s, [150, 117], 16)).toEqual([]);
	});

	it("hits when the eraser segment crosses a sparse stroke segment", () => {
		// ストロークの点は両端だけ。点同士の距離では当たらないが、線分は交差する
		expect(
			strokesHitByEraser([stroke([0, 0, 400, 0])], [200, -100, 200, 100], 16),
		).toEqual([0]);
	});

	it("hits a dot stroke", () => {
		expect(
			strokesHitByEraser([stroke([50, 50])], [60, 50, 70, 50], 16),
		).toEqual([0]);
	});

	it("returns all hit indices in ascending order", () => {
		const strokes = [
			stroke([0, 0, 100, 0]),
			stroke([0, 500, 100, 500]),
			stroke([0, 10, 100, 10]),
		];
		expect(strokesHitByEraser(strokes, [50, 5], 16)).toEqual([0, 2]);
	});

	it("returns nothing for an empty eraser path", () => {
		expect(strokesHitByEraser([stroke([0, 0, 100, 0])], [], 16)).toEqual([]);
	});
});
