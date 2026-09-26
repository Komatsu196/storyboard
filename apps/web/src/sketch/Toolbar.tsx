import type { PointerEvent as ReactPointerEvent } from "react";
import {
	type StrokeColor,
	type StrokeSize,
	strokeColors,
	strokeSizes,
} from "../../shared/sketch/types";
import type { Tool } from "./useSketchEditor";

const colorLabels: Record<StrokeColor, string> = { black: "黒", red: "赤" };
const sizeLabels: Record<StrokeSize, string> = { 1: "細", 2: "中", 3: "太" };

function buttonClass(active: boolean, activeClass = "bg-black text-white") {
	// 44px 以上のタップ目標、ダブルタップでのズームを止める（touch-manipulation）
	return `min-h-11 min-w-11 flex-1 touch-manipulation rounded text-sm ${
		active ? activeClass : "bg-gray-100 active:bg-gray-200"
	}`;
}

/** 黒・赤｜細・中・太｜消しゴム の 6 個（戻す・やり直す・全消しはヘッダ側。T-013） */
export function Toolbar({
	tool,
	onChange,
}: {
	tool: Tool;
	onChange: (tool: Tool) => void;
}) {
	const isPen = tool.mode === "pen";
	// スマホでは click の合成がストローク直後の 1 タップ目で抜けることがある（二重タップ判定など）ので、
	// 指が触れた瞬間（pointerdown）にも切り替える。click はキーボード操作用に残す（同じ値なので二重に効いても無害）
	const select = (next: Tool) => ({
		onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
			if (e.isPrimary && e.button === 0) onChange(next);
		},
		onClick: () => onChange(next),
	});
	return (
		<div
			className="flex shrink-0 items-center gap-1 border-t bg-white p-1 md:pb-[max(0.25rem,env(safe-area-inset-bottom))]"
			role="toolbar"
			aria-label="ツール"
		>
			{strokeColors.map((color) => (
				<button
					key={color}
					type="button"
					aria-pressed={isPen && tool.color === color}
					className={buttonClass(
						isPen && tool.color === color,
						color === "red" ? "bg-red-600 text-white" : "bg-black text-white",
					)}
					{...select({ ...tool, mode: "pen", color })}
				>
					{colorLabels[color]}
				</button>
			))}
			<span className="mx-1 h-6 w-px bg-gray-300" />
			{strokeSizes.map((size) => (
				<button
					key={size}
					type="button"
					aria-pressed={isPen && tool.size === size}
					className={buttonClass(isPen && tool.size === size)}
					{...select({ ...tool, mode: "pen", size })}
				>
					{sizeLabels[size]}
				</button>
			))}
			<span className="mx-1 h-6 w-px bg-gray-300" />
			<button
				type="button"
				aria-pressed={tool.mode === "eraser"}
				className={buttonClass(tool.mode === "eraser")}
				{...select({ ...tool, mode: "eraser" })}
			>
				消しゴム
			</button>
		</div>
	);
}
