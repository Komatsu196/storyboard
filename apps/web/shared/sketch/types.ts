import { z } from "zod";
import type { AspectRatio } from "../schemas";

/** 論理座標系の大きさ。長辺 1600 固定（設計書 §3.2） */
export const canvasSizes: Record<AspectRatio, { w: number; h: number }> = {
	"16:9": { w: 1600, h: 900 },
	"9:16": { w: 900, h: 1600 },
	"4:3": { w: 1600, h: 1200 },
	"2.39:1": { w: 1600, h: 670 },
};

export const strokeColors = ["black", "red"] as const;
export type StrokeColor = (typeof strokeColors)[number];
export const strokeSizes = [1, 2, 3] as const;
export type StrokeSize = (typeof strokeSizes)[number];
/** 太さ段階 → 論理単位の線幅（実機で調整可） */
export const lineWidths: Record<StrokeSize, number> = { 1: 6, 2: 12, 3: 20 };

/** 間引き: 直前に採用した点からこの距離未満の点は捨てる */
export const MIN_POINT_DISTANCE = 3;
/** 消しゴムの半径（論理単位。実機で調整可） */
export const ERASER_RADIUS = 16;
export const MAX_STROKES = 2000;
export const MAX_POINTS_PER_STROKE = 10_000;

export const strokeSchema = z.object({
	color: z.enum(strokeColors),
	size: z.union([z.literal(1), z.literal(2), z.literal(3)]),
	// 論理座標の整数を x, y 交互に並べた平坦配列（偶数長）
	p: z
		.array(z.number().int())
		.min(2)
		.max(MAX_POINTS_PER_STROKE * 2)
		.refine((p) => p.length % 2 === 0, {
			message: "p must have an even length",
		}),
});

export const sketchDataSchema = z.object({
	v: z.literal(1),
	w: z.number().int().positive(),
	h: z.number().int().positive(),
	strokes: z.array(strokeSchema).max(MAX_STROKES),
});

export type Stroke = z.infer<typeof strokeSchema>;
export type SketchData = z.infer<typeof sketchDataSchema>;

export function emptySketch(aspectRatio: AspectRatio): SketchData {
	const { w, h } = canvasSizes[aspectRatio];
	return { v: 1, w, h, strokes: [] };
}
