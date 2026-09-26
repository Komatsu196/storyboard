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

/** PATCH /api/projects/:id（T-019）。送られた項目だけ更新する。作成時と違い既定値は付けない */
export const updateProjectSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	aspectRatio: aspectRatioSchema.optional(),
});
export type UpdateProject = z.infer<typeof updateProjectSchema>;

/** PATCH /api/scenes/:id（T-018） */
export const updateSceneSchema = z.object({
	number: z.string().trim().min(1).max(20).optional(),
	title: z.string().trim().max(200).optional(),
});
export type UpdateScene = z.infer<typeof updateSceneSchema>;

/** PUT …/order。兄弟の ID を新しい並び順で全部送る（T-007） */
export const orderSchema = z.object({
	ids: z.array(z.string().min(1)).max(1000),
});

// カットの固定リスト（D-007）。フォームのチップもここから生成する
export const shotSizes = ["LS", "FS", "MS", "BS", "CU", "ECU"] as const;
export type ShotSize = (typeof shotSizes)[number];
export const cameraMoves = [
	"Fix",
	"Pan",
	"Tilt",
	"Dolly",
	"Handheld",
	"Gimbal",
] as const;

/** カット情報のうち画（スケッチ）を除く 7 項目。フォームの状態と PATCH の本文がこの形（設計書 §4・§6.5） */
export const shotFieldsSchema = z.object({
	number: z.string().trim().min(1).max(20),
	shotSize: z.enum(shotSizes).nullable(),
	// チップの値も自由入力も同じ 1 列
	cameraMove: z.string().trim().max(100),
	// 複数行は trim しない
	action: z.string().max(2000),
	dialogue: z.string().max(2000),
	durationSec: z.number().nonnegative().nullable(),
	notes: z.string().max(2000),
});
export type ShotFields = z.infer<typeof shotFieldsSchema>;
export const shotFieldKeys = Object.keys(
	shotFieldsSchema.shape,
) as (keyof ShotFields)[];

/** PATCH /api/shots/:id の本文。送られた項目だけ更新する */
export const updateShotSchema = shotFieldsSchema.partial();
export type UpdateShot = z.infer<typeof updateShotSchema>;

/** DB の text 列など型の保証がない値を ShotSize に寄せる（未知の値・null は null） */
export function toShotSize(value: string | null): ShotSize | null {
	return value !== null && (shotSizes as readonly string[]).includes(value)
		? (value as ShotSize)
		: null;
}

/** カット行から 7 項目を取り出す（フォームの初期値・キャッシュ更新に使う） */
export function pickShotFields(shot: {
	number: string;
	shotSize: string | null;
	cameraMove: string;
	action: string;
	dialogue: string;
	durationSec: number | null;
	notes: string;
}): ShotFields {
	return {
		number: shot.number,
		shotSize: toShotSize(shot.shotSize),
		cameraMove: shot.cameraMove,
		action: shot.action,
		dialogue: shot.dialogue,
		durationSec: shot.durationSec,
		notes: shot.notes,
	};
}

/** 7 項目がすべて同じか（自動保存の「保存済み」判定に使う。参照ではなく値で比べる） */
export function shotFieldsEqual(a: ShotFields, b: ShotFields): boolean {
	return shotFieldKeys.every((key) => a[key] === b[key]);
}
