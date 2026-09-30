import { Eraser } from "lucide-react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
	type StrokeColor,
	type StrokeSize,
	strokeColors,
	strokeSizes,
} from "../../shared/sketch/types";
import { displayColor } from "./render";
import type { Tool } from "./useSketchEditor";

const colorLabels: Record<StrokeColor, string> = { black: "黒", red: "赤" };
const sizeLabels: Record<StrokeSize, string> = { 1: "細", 2: "中", 3: "太" };
// 太さの点の直径（4 / 8 / 12px）
const sizeDots: Record<StrokeSize, string> = {
	1: "size-1",
	2: "size-2",
	3: "size-3",
};

function toolClass(active: boolean) {
	// 44px 以上のタップ目標、ダブルタップでのズームを止める（touch-manipulation）。選択中は薄い藍の地＋藍の輪（T-027）
	return `flex min-h-11 min-w-11 flex-1 touch-manipulation items-center justify-center rounded-md ${
		active ? "bg-accent-soft ring-2 ring-accent ring-inset" : "active:bg-line"
	}`;
}

/** 黒・赤（色見本）｜細・中・太（点）｜消しゴム（アイコン）の 6 個（戻す・やり直す・全消しはヘッダ側。T-013 / T-027） */
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
			className="flex shrink-0 items-center gap-1 border-line border-t bg-surface p-1 md:pb-[max(0.25rem,env(safe-area-inset-bottom))]"
			role="toolbar"
			aria-label="ツール"
		>
			{strokeColors.map((color) => (
				<button
					key={color}
					type="button"
					aria-label={colorLabels[color]}
					title={colorLabels[color]}
					aria-pressed={isPen && tool.color === color}
					className={toolClass(isPen && tool.color === color)}
					{...select({ ...tool, mode: "pen", color })}
				>
					<span
						aria-hidden
						className="size-5 rounded-full"
						style={{ backgroundColor: displayColor[color] }}
					/>
				</button>
			))}
			<span className="mx-1 h-6 w-px bg-line" />
			{strokeSizes.map((size) => (
				<button
					key={size}
					type="button"
					aria-label={sizeLabels[size]}
					title={sizeLabels[size]}
					aria-pressed={isPen && tool.size === size}
					className={toolClass(isPen && tool.size === size)}
					{...select({ ...tool, mode: "pen", size })}
				>
					<span
						aria-hidden
						className={`${sizeDots[size]} rounded-full bg-ink`}
					/>
				</button>
			))}
			<span className="mx-1 h-6 w-px bg-line" />
			<button
				type="button"
				aria-label="消しゴム"
				title="消しゴム"
				aria-pressed={tool.mode === "eraser"}
				className={toolClass(tool.mode === "eraser")}
				{...select({ ...tool, mode: "eraser" })}
			>
				<Eraser aria-hidden className="size-5" />
			</button>
		</div>
	);
}
