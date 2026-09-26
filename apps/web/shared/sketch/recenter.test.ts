import { describe, expect, it } from "vitest";
import { aspectRatios } from "../schemas";
import { recenterSketch } from "./recenter";
import { canvasSizes, type SketchData } from "./types";

const sketch: SketchData = {
	v: 1,
	w: 1600,
	h: 900,
	strokes: [
		{ color: "black", size: 2, p: [800, 450, 0, 0, 1600, 900] },
		{ color: "red", size: 1, p: [10, 20] },
	],
};

describe("recenterSketch", () => {
	it("keeps the drawing size and aligns the centers (16:9 → 9:16)", () => {
		const out = recenterSketch(sketch, canvasSizes["9:16"]);
		expect(out.w).toBe(900);
		expect(out.h).toBe(1600);
		// dx = (900 - 1600) / 2 = -350, dy = (1600 - 900) / 2 = 350。枠外（負の座標）も捨てない
		expect(out.strokes.map((s) => s.p)).toEqual([
			[450, 800, -350, 350, 1250, 1250],
			[-340, 370],
		]);
		expect(out.strokes.map((s) => [s.color, s.size])).toEqual([
			["black", 2],
			["red", 1],
		]);
	});

	it("round-trips exactly between every pair of aspect ratios", () => {
		for (const from of aspectRatios) {
			for (const to of aspectRatios) {
				const start = { ...sketch, ...canvasSizes[from] };
				const back = recenterSketch(
					recenterSketch(start, canvasSizes[to]),
					canvasSizes[from],
				);
				expect(back).toEqual(start);
			}
		}
	});

	it("shifts by whole numbers for every pair", () => {
		for (const from of aspectRatios) {
			for (const to of aspectRatios) {
				const out = recenterSketch(
					{ ...sketch, ...canvasSizes[from] },
					canvasSizes[to],
				);
				for (const s of out.strokes) {
					expect(s.p.every(Number.isInteger)).toBe(true);
				}
			}
		}
	});

	it("returns the same object when the size does not change", () => {
		expect(recenterSketch(sketch, { w: 1600, h: 900 })).toBe(sketch);
	});

	it("does not mutate the input", () => {
		recenterSketch(sketch, canvasSizes["4:3"]);
		expect(sketch.w).toBe(1600);
		expect(sketch.strokes[0].p).toEqual([800, 450, 0, 0, 1600, 900]);
	});
});
