import { describe, expect, it } from "vitest";
import { emptySketch, MAX_STROKES, sketchDataSchema } from "./types";

const stroke = { color: "black", size: 2, p: [0, 0, 10, 10] };
const sketch = (overrides: Record<string, unknown>) => ({
	v: 1,
	w: 1600,
	h: 900,
	strokes: [stroke],
	...overrides,
});

describe("sketchDataSchema", () => {
	it("accepts an empty sketch and a sketch with strokes", () => {
		expect(sketchDataSchema.safeParse(emptySketch("16:9")).success).toBe(true);
		expect(sketchDataSchema.safeParse(sketch({})).success).toBe(true);
	});

	it("rejects an odd-length point array", () => {
		const bad = sketch({ strokes: [{ ...stroke, p: [0, 0, 10] }] });
		expect(sketchDataSchema.safeParse(bad).success).toBe(false);
	});

	it("rejects non-integer coordinates, unknown colors and sizes", () => {
		expect(
			sketchDataSchema.safeParse(
				sketch({ strokes: [{ ...stroke, p: [0.5, 0] }] }),
			).success,
		).toBe(false);
		expect(
			sketchDataSchema.safeParse(
				sketch({ strokes: [{ ...stroke, color: "blue" }] }),
			).success,
		).toBe(false);
		expect(
			sketchDataSchema.safeParse(sketch({ strokes: [{ ...stroke, size: 4 }] }))
				.success,
		).toBe(false);
	});

	it("rejects more than MAX_STROKES strokes and a wrong version", () => {
		const strokes = Array.from({ length: MAX_STROKES + 1 }, () => stroke);
		expect(sketchDataSchema.safeParse(sketch({ strokes })).success).toBe(false);
		expect(sketchDataSchema.safeParse(sketch({ v: 2 })).success).toBe(false);
	});
});

describe("emptySketch", () => {
	it("uses the logical size of the aspect ratio", () => {
		expect(emptySketch("9:16")).toEqual({ v: 1, w: 900, h: 1600, strokes: [] });
	});
});
