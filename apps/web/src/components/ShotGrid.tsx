import { Link } from "@tanstack/react-router";
import type { AspectRatio } from "../../shared/schemas";
import type { Shot } from "../api/client";
import { SketchThumb } from "../sketch/SketchThumb";

/** サムネイル＋カット番号のグリッド。スマホ 2 列、PC 3〜5 列 */
export function ShotGrid({
	projectId,
	aspectRatio,
	shots,
}: {
	projectId: string;
	aspectRatio: AspectRatio;
	shots: Shot[];
}) {
	if (shots.length === 0) {
		return <p className="text-gray-400 text-sm">カットがありません</p>;
	}
	return (
		<ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
			{shots.map((shot) => (
				<li key={shot.id}>
					<Link
						to="/projects/$projectId/shots/$shotId"
						params={{ projectId, shotId: shot.id }}
						className="block"
					>
						<SketchThumb sketch={shot.sketch} aspectRatio={aspectRatio} />
						<div className="mt-1 text-sm">C{shot.number}</div>
					</Link>
				</li>
			))}
		</ul>
	);
}
