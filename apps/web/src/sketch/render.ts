import {
	lineWidths,
	type SketchData,
	type Stroke,
	type StrokeColor,
} from "../../shared/sketch/types";

/** データ上の色 → 画面上の色（ここだけで決める） */
export const displayColor: Record<StrokeColor, string> = {
	black: "#111827",
	red: "#dc2626",
};

export function renderStroke(
	ctx: CanvasRenderingContext2D,
	stroke: Stroke,
	scale: number,
): void {
	const p = stroke.p;
	if (p.length < 2) return;
	ctx.strokeStyle = displayColor[stroke.color];
	ctx.lineWidth = lineWidths[stroke.size] * scale;
	ctx.beginPath();
	ctx.moveTo(p[0] * scale, p[1] * scale);
	// 点 1 つのストロークは同じ座標へ lineTo すると丸いキャップで点になる
	if (p.length === 2) ctx.lineTo(p[0] * scale, p[1] * scale);
	for (let i = 2; i < p.length; i += 2) {
		ctx.lineTo(p[i] * scale, p[i + 1] * scale);
	}
	ctx.stroke();
}

/** 論理座標 × scale で描く。エディタの base 層とサムネイルで共用（T-003） */
export function renderStrokes(
	ctx: CanvasRenderingContext2D,
	sketch: SketchData,
	scale: number,
): void {
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	for (const stroke of sketch.strokes) renderStroke(ctx, stroke, scale);
}

/** 幅 cw × 高さ ch（CSS px）の枠に収めて中央に描く（アスペクト比が違えばレターボックス） */
export function renderSketchFit(
	ctx: CanvasRenderingContext2D,
	sketch: SketchData,
	cw: number,
	ch: number,
): void {
	const scale = Math.min(cw / sketch.w, ch / sketch.h);
	ctx.save();
	ctx.translate((cw - sketch.w * scale) / 2, (ch - sketch.h * scale) / 2);
	renderStrokes(ctx, sketch, scale);
	ctx.restore();
}
