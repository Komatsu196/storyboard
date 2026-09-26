import { Link } from "@tanstack/react-router";
import type { AspectRatio } from "../../shared/schemas";
import type { Shot } from "../api/client";
import { SketchThumb } from "../sketch/SketchThumb";
import { shotMeta } from "./shotMeta";

/**
 * 作品ページのカード（設計書 §5.4）。
 * スマホ（< md）は「左にスケッチ・右に情報」の横並びで現場用の閲覧に、
 * PC（≥ md）は「サムネイル → メタ 1 行 → 内容 1 行」の縦並びで俯瞰に使う（T-014 / T-015）。
 * 空の項目は行ごと出さない。カード全体がカット編集へのリンク。
 */
export function ShotCard({
	projectId,
	aspectRatio,
	shot,
}: {
	projectId: string;
	aspectRatio: AspectRatio;
	shot: Shot;
}) {
	const [number, ...meta] = shotMeta(shot);
	return (
		<Link
			to="/projects/$projectId/shots/$shotId"
			params={{ projectId, shotId: shot.id }}
			className="flex gap-3 md:block"
		>
			<div className="w-36 shrink-0 md:w-full">
				<SketchThumb sketch={shot.sketch} aspectRatio={aspectRatio} />
			</div>
			<div className="min-w-0 flex-1 text-sm md:mt-1">
				<div>
					<span className="font-bold">{number}</span>
					{meta.length > 0 && (
						<span className="ml-2 text-gray-600">{meta.join("　")}</span>
					)}
				</div>
				{shot.action !== "" && (
					<p className="mt-1 whitespace-pre-wrap md:line-clamp-1 md:whitespace-normal">
						{shot.action}
					</p>
				)}
				{shot.dialogue !== "" && (
					<p className="mt-1 whitespace-pre-wrap md:hidden">
						<span className="mr-1 text-gray-500 text-xs">セリフ</span>
						{shot.dialogue}
					</p>
				)}
				{shot.notes !== "" && (
					<p className="mt-1 whitespace-pre-wrap md:hidden">
						<span className="mr-1 text-gray-500 text-xs">備考</span>
						{shot.notes}
					</p>
				)}
			</div>
		</Link>
	);
}
