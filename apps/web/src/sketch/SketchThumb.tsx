import { useEffect, useRef } from "react";
import type { AspectRatio } from "../../shared/schemas";
import { canvasSizes, type SketchData } from "../../shared/sketch/types";
import { renderSketchFit } from "./render";

/** 作品ページ用の小さなサムネイル。空なら枠だけ。DPR に合わせて鮮明に描く */
export function SketchThumb({
	sketch,
	aspectRatio,
}: {
	sketch: SketchData | null;
	aspectRatio: AspectRatio;
}) {
	const ref = useRef<HTMLCanvasElement>(null);
	const { w, h } = canvasSizes[aspectRatio];

	useEffect(() => {
		const canvas = ref.current;
		if (!canvas) return;
		const draw = () => {
			const rect = canvas.getBoundingClientRect();
			if (rect.width === 0) return;
			const dpr = window.devicePixelRatio || 1;
			canvas.width = Math.round(rect.width * dpr);
			canvas.height = Math.round(rect.height * dpr);
			const ctx = canvas.getContext("2d");
			if (!ctx) return;
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
			if (sketch) renderSketchFit(ctx, sketch, rect.width, rect.height);
		};
		const observer = new ResizeObserver(draw);
		observer.observe(canvas);
		draw();
		return () => observer.disconnect();
	}, [sketch]);

	return (
		<canvas
			ref={ref}
			className="block w-full rounded-sm border border-line-strong bg-white"
			style={{ aspectRatio: `${w} / ${h}` }}
		/>
	);
}
