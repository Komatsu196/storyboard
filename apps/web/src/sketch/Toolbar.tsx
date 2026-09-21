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
	return (
		<div
			className="flex shrink-0 items-center gap-1 border-t bg-white p-1"
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
					onClick={() => onChange({ ...tool, mode: "pen", color })}
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
					onClick={() => onChange({ ...tool, mode: "pen", size })}
				>
					{sizeLabels[size]}
				</button>
			))}
			<span className="mx-1 h-6 w-px bg-gray-300" />
			<button
				type="button"
				aria-pressed={tool.mode === "eraser"}
				className={buttonClass(tool.mode === "eraser")}
				onClick={() => onChange({ ...tool, mode: "eraser" })}
			>
				消しゴム
			</button>
		</div>
	);
}
