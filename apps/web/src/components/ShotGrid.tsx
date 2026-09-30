import type { Delta } from "../../shared/order";
import type { AspectRatio } from "../../shared/schemas";
import type { Shot } from "../api/client";
import { ItemActions } from "./ItemActions";
import { ShotCard } from "./ShotCard";

export type ShotEdit = {
	onMove: (shotId: string, delta: Delta) => void;
	onDelete: (shot: Shot) => void;
	disabled?: boolean;
};

/**
 * カットの一覧。スマホ 1 列（横並びカード）、PC 3〜5 列（設計書 §5.4）。カードの形は ShotCard が持つ。
 * edit があるとき（編集モード）はカードの下に 前へ / 後へ / カットを削除 を出す（T-017 / T-021）
 */
export function ShotGrid({
	projectId,
	aspectRatio,
	shots,
	edit,
}: {
	projectId: string;
	aspectRatio: AspectRatio;
	shots: Shot[];
	edit?: ShotEdit;
}) {
	if (shots.length === 0) {
		return <p className="text-ink-muted text-sm">カットがありません</p>;
	}
	return (
		<ul className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-3 lg:grid-cols-4 xl:grid-cols-5">
			{shots.map((shot, i) => (
				<li key={shot.id}>
					<ShotCard
						projectId={projectId}
						aspectRatio={aspectRatio}
						shot={shot}
						editing={edit !== undefined}
					/>
					{edit && (
						<div className="mt-2">
							<ItemActions
								isFirst={i === 0}
								isLast={i === shots.length - 1}
								onMove={(delta) => edit.onMove(shot.id, delta)}
								onDelete={() => edit.onDelete(shot)}
								disabled={edit.disabled}
							/>
						</div>
					)}
				</li>
			))}
		</ul>
	);
}
