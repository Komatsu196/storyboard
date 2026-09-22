import { MIN_POINT_DISTANCE } from "./types";

/**
 * 平坦な点列 [x0, y0, x1, y1, …] から、直前に採用した点との距離が minDist 未満の点を捨てる。
 * 始点と終点は必ず残す（終点が直前の採用点と同じ座標なら重複させない）。
 */
export function simplifyPoints(
	p: readonly number[],
	minDist = MIN_POINT_DISTANCE,
): number[] {
	if (p.length <= 2) return [...p];
	const out = [p[0], p[1]];
	let lx = p[0];
	let ly = p[1];
	for (let i = 2; i < p.length - 2; i += 2) {
		const x = p[i];
		const y = p[i + 1];
		if (Math.hypot(x - lx, y - ly) >= minDist) {
			out.push(x, y);
			lx = x;
			ly = y;
		}
	}
	const ex = p[p.length - 2];
	const ey = p[p.length - 1];
	if (ex !== lx || ey !== ly) out.push(ex, ey);
	return out;
}
