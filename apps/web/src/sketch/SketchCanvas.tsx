import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { simplifyPoints } from "../../shared/sketch/simplify";
import {
	lineWidths,
	MAX_POINTS_PER_STROKE,
	type SketchData,
	type Stroke,
	type StrokeColor,
	type StrokeSize,
} from "../../shared/sketch/types";
import { displayColor, renderStroke, renderStrokes } from "./render";
import type { Tool } from "./useSketchEditor";

type Props = {
	sketch: SketchData;
	tool: Tool;
	/** ペンを離したとき（間引き済みの 1 本） */
	onStroke: (stroke: Stroke) => void;
	/** 消しゴムの pointerdown / pointermove ごと。[x0, y0, x1, y1] の線分（論理座標） */
	onErase: (segment: number[]) => void;
	onEraseEnd: () => void;
	onEraseCancel: () => void;
};

// 1 本の操作。ペンは pointerdown 時の色・太さを持つ（途中でツールが変わっても影響しない）
type Gesture =
	| {
			kind: "pen";
			pointerId: number;
			color: StrokeColor;
			size: StrokeSize;
			points: number[];
	  }
	| { kind: "eraser"; pointerId: number; x: number; y: number };

type Size = { w: number; h: number };

const clamp = (v: number, min: number, max: number) =>
	Math.min(max, Math.max(min, v));

export function SketchCanvas({
	sketch,
	tool,
	onStroke,
	onErase,
	onEraseEnd,
	onEraseCancel,
}: Props) {
	const areaRef = useRef<HTMLDivElement>(null);
	const baseRef = useRef<HTMLCanvasElement>(null);
	const liveRef = useRef<HTMLCanvasElement>(null);
	const gestureRef = useRef<Gesture | null>(null);
	const [size, setSize] = useState<Size>({ w: 0, h: 0 }); // CSS px
	const scale = size.w > 0 ? size.w / sketch.w : 0;

	// 親要素の幅と高さの両方に収まる最大の大きさにする（T-013）。回転などの変化は ResizeObserver で追う
	useLayoutEffect(() => {
		const area = areaRef.current;
		if (!area) return;
		const fitToArea = () => {
			const { width, height } = area.getBoundingClientRect();
			const w = Math.max(
				0,
				Math.floor(Math.min(width, (height * sketch.w) / sketch.h)),
			);
			setSize({ w, h: Math.floor((w * sketch.h) / sketch.w) });
		};
		const observer = new ResizeObserver(fitToArea);
		observer.observe(area);
		fitToArea();
		return () => observer.disconnect();
	}, [sketch.w, sketch.h]);

	// backing store を DPR に合わせ（大きさが変わったときだけ）、base 層に確定ストロークを描き直す
	useEffect(() => {
		const dpr = window.devicePixelRatio || 1;
		const pw = Math.round(size.w * dpr);
		const ph = Math.round(size.h * dpr);
		for (const canvas of [baseRef.current, liveRef.current]) {
			if (!canvas || (canvas.width === pw && canvas.height === ph)) continue;
			canvas.width = pw;
			canvas.height = ph;
			canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
		}
		// リサイズ（回転など）でも live 層が消えたままにならないよう、描きかけのペンを新しい scale で描き直す
		const g = gestureRef.current;
		if (size.w > 0 && g?.kind === "pen") {
			const liveCtx = liveRef.current?.getContext("2d");
			if (liveCtx) {
				liveCtx.lineCap = "round";
				liveCtx.lineJoin = "round";
				renderStroke(
					liveCtx,
					{ color: g.color, size: g.size, p: g.points },
					scale,
				);
			}
		}
		const ctx = baseRef.current?.getContext("2d");
		if (!ctx || size.w === 0) return;
		ctx.clearRect(0, 0, size.w, size.h);
		renderStrokes(ctx, sketch, scale);
	}, [sketch, size, scale]);

	// CSS px → 論理座標（端末に依存しない。設計書 §6.2）
	const toLogical = (
		e: { clientX: number; clientY: number },
		rect: DOMRect,
	): [number, number] => [
		clamp(
			Math.round(((e.clientX - rect.left) / rect.width) * sketch.w),
			0,
			sketch.w,
		),
		clamp(
			Math.round(((e.clientY - rect.top) / rect.height) * sketch.h),
			0,
			sketch.h,
		),
	];

	// live 層に直前の点から現在の点まで 1 線分を足す（React を通さない）
	const drawLive = (
		g: Extract<Gesture, { kind: "pen" }>,
		x0: number,
		y0: number,
		x1: number,
		y1: number,
	) => {
		const ctx = liveRef.current?.getContext("2d");
		if (!ctx) return;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.strokeStyle = displayColor[g.color];
		ctx.lineWidth = lineWidths[g.size] * scale;
		ctx.beginPath();
		ctx.moveTo(x0 * scale, y0 * scale);
		ctx.lineTo(x1 * scale, y1 * scale);
		ctx.stroke();
	};
	const clearLive = () => {
		liveRef.current?.getContext("2d")?.clearRect(0, 0, size.w, size.h);
	};

	const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
		// 2 本目の指・右クリックは無視（設計書 §6.3）
		if (!e.isPrimary || gestureRef.current || scale === 0) return;
		if (e.pointerType === "mouse" && e.button !== 0) return;
		e.currentTarget.setPointerCapture(e.pointerId);
		const [x, y] = toLogical(e, e.currentTarget.getBoundingClientRect());
		if (tool.mode === "pen") {
			const g: Gesture = {
				kind: "pen",
				pointerId: e.pointerId,
				color: tool.color,
				size: tool.size,
				points: [x, y],
			};
			gestureRef.current = g;
			drawLive(g, x, y, x, y); // タップだけでも点が出る
		} else {
			gestureRef.current = { kind: "eraser", pointerId: e.pointerId, x, y };
			onErase([x, y, x, y]);
		}
	};

	const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
		const g = gestureRef.current;
		if (!g || g.pointerId !== e.pointerId) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const native = e.nativeEvent;
		// 間引かれたイベントも拾う（無ければ単発。Safari 向け）
		const coalesced =
			typeof native.getCoalescedEvents === "function"
				? native.getCoalescedEvents()
				: [];
		for (const ev of coalesced.length > 0 ? coalesced : [native]) {
			const [x, y] = toLogical(ev, rect);
			if (g.kind === "pen") {
				if (g.points.length >= MAX_POINTS_PER_STROKE * 2) break;
				const n = g.points.length;
				drawLive(g, g.points[n - 2], g.points[n - 1], x, y);
				g.points.push(x, y);
			} else {
				onErase([g.x, g.y, x, y]);
				g.x = x;
				g.y = y;
			}
		}
	};

	const finish = (
		e: ReactPointerEvent<HTMLCanvasElement>,
		cancelled: boolean,
	) => {
		const g = gestureRef.current;
		if (!g || g.pointerId !== e.pointerId) return;
		gestureRef.current = null;
		if (e.currentTarget.hasPointerCapture(e.pointerId)) {
			e.currentTarget.releasePointerCapture(e.pointerId);
		}
		if (g.kind === "pen") {
			clearLive();
			if (!cancelled) {
				onStroke({ color: g.color, size: g.size, p: simplifyPoints(g.points) });
			}
		} else if (cancelled) {
			onEraseCancel();
		} else {
			onEraseEnd();
		}
	};

	return (
		<div
			ref={areaRef}
			className="flex h-full w-full items-center justify-center overflow-hidden"
		>
			{/* この箱がフレーム枠。canvas は透明で、白背景と枠線は箱が持つ */}
			<div
				className="relative select-none border border-gray-400 bg-white shadow-sm [-webkit-touch-callout:none]"
				style={{ width: size.w, height: size.h }}
			>
				<canvas
					ref={baseRef}
					className="absolute inset-0"
					style={{ width: size.w, height: size.h }}
				/>
				<canvas
					ref={liveRef}
					className="absolute inset-0 touch-none"
					style={{ width: size.w, height: size.h }}
					onPointerDown={onPointerDown}
					onPointerMove={onPointerMove}
					onPointerUp={(e) => finish(e, false)}
					onPointerCancel={(e) => finish(e, true)}
					onContextMenu={(e) => e.preventDefault()}
				/>
			</div>
		</div>
	);
}
