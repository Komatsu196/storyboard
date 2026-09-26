import type { AspectRatio } from "../../shared/schemas";
import type { Shot } from "../api/client";
import { ShotCard } from "./ShotCard";

/** カットの一覧。スマホ 1 列（横並びカード）、PC 3〜5 列（設計書 §5.4）。カードの形は ShotCard が持つ */
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
		<ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
			{shots.map((shot) => (
				<li key={shot.id}>
					<ShotCard
						projectId={projectId}
						aspectRatio={aspectRatio}
						shot={shot}
					/>
				</li>
			))}
		</ul>
	);
}
