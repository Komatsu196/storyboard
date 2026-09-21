import { ERASER_RADIUS, type Stroke } from "./types";

type Segment = [number, number, number, number];

/** 平坦な点列を線分に分ける。点が 1 つなら長さ 0 の線分 */
function segments(p: readonly number[]): Segment[] {
	if (p.length < 2) return [];
	if (p.length === 2) return [[p[0], p[1], p[0], p[1]]];
	const out: Segment[] = [];
	for (let i = 0; i + 3 < p.length; i += 2) {
		out.push([p[i], p[i + 1], p[i + 2], p[i + 3]]);
	}
	return out;
}

function distPointToSegment(
	px: number,
	py: number,
	[ax, ay, bx, by]: Segment,
): number {
	const dx = bx - ax;
	const dy = by - ay;
	const len2 = dx * dx + dy * dy;
	const t =
		len2 === 0
			? 0
			: Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
	return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function orient(
	ax: number,
	ay: number,
	bx: number,
	by: number,
	cx: number,
	cy: number,
): number {
	return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/** 2 線分が真に交差するか（端点で触れるだけ・平行に重なる場合は距離判定に任せる） */
function intersects(
	[ax, ay, bx, by]: Segment,
	[cx, cy, dx, dy]: Segment,
): boolean {
	const o1 = orient(ax, ay, bx, by, cx, cy);
	const o2 = orient(ax, ay, bx, by, dx, dy);
	const o3 = orient(cx, cy, dx, dy, ax, ay);
	const o4 = orient(cx, cy, dx, dy, bx, by);
	return o1 * o2 < 0 && o3 * o4 < 0;
}

/** 線分同士の距離が radius 以下か（交差していれば距離 0） */
function segmentsWithin(a: Segment, b: Segment, radius: number): boolean {
	if (intersects(a, b)) return true;
	return (
		Math.min(
			distPointToSegment(a[0], a[1], b),
			distPointToSegment(a[2], a[3], b),
			distPointToSegment(b[0], b[1], a),
			distPointToSegment(b[2], b[3], a),
		) <= radius
	);
}

/**
 * 消しゴムの軌跡（平坦な点列）に半径 radius 以内で触れたストロークの index を昇順で返す。
 * ストロークの線分と軌跡の線分の距離で判定する（点同士だと速い指の動きで隙間をすり抜けるため。T-012）。
 */
export function strokesHitByEraser(
	strokes: readonly Stroke[],
	eraserPath: readonly number[],
	radius = ERASER_RADIUS,
): number[] {
	const eraserSegments = segments(eraserPath);
	if (eraserSegments.length === 0) return [];
	const hits: number[] = [];
	strokes.forEach((stroke, index) => {
		const strokeSegments = segments(stroke.p);
		const hit = strokeSegments.some((s) =>
			eraserSegments.some((e) => segmentsWithin(s, e, radius)),
		);
		if (hit) hits.push(index);
	});
	return hits;
}
