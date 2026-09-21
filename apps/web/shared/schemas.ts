import { z } from "zod";

// 固定リストの唯一の定義場所（T-005）。クライアントの選択肢 UI もここから生成する。
export const aspectRatios = ["16:9", "9:16", "4:3", "2.39:1"] as const;
export type AspectRatio = (typeof aspectRatios)[number];
export const DEFAULT_ASPECT_RATIO: AspectRatio = "16:9";
export const aspectRatioSchema = z.enum(aspectRatios);

/** DB の text 列など型の保証がない文字列を AspectRatio に寄せる（未知の値は既定値） */
export function toAspectRatio(value: string): AspectRatio {
	return (aspectRatios as readonly string[]).includes(value)
		? (value as AspectRatio)
		: DEFAULT_ASPECT_RATIO;
}

export const createProjectSchema = z.object({
	title: z.string().trim().min(1).max(200),
	aspectRatio: aspectRatioSchema.default(DEFAULT_ASPECT_RATIO),
});

export const createSceneSchema = z.object({
	title: z.string().trim().max(200).default(""),
});
