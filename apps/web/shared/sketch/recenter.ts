import type { SketchData } from "./types";

/**
 * アスペクト比の変更で枠だけを差し替える（T-020）。
 * 絵の大きさは変えず、新しい枠の中心に古い枠の中心を合わせるよう座標をずらす（撮影でクロップし直すのと同じ）。
 * 枠からはみ出した点も捨てないので、比率を戻せば元の座標に戻る。
 * 4 つの比率の辺の差はすべて偶数なので、ずらす量は整数になる。
 */
export function recenterSketch(
	data: SketchData,
	size: { w: number; h: number },
): SketchData {
	if (data.w === size.w && data.h === size.h) return data;
	const dx = Math.round((size.w - data.w) / 2);
	const dy = Math.round((size.h - data.h) / 2);
	return {
		...data,
		w: size.w,
		h: size.h,
		strokes: data.strokes.map((stroke) => ({
			...stroke,
			p: stroke.p.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
		})),
	};
}
