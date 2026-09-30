import type { Delta } from "../../shared/order";
import type { UpdateScene } from "../../shared/schemas";
import type { Scene } from "../api/client";
import { InlineField } from "./InlineField";
import { ItemActions } from "./ItemActions";
import { Button } from "./ui/Button";

export type SceneEdit = {
	isFirst: boolean;
	isLast: boolean;
	onMove: (delta: Delta) => void;
	onDelete: () => void;
	onCommit: (input: UpdateScene) => void;
	disabled?: boolean;
};

/**
 * シーン見出し。edit があるとき（編集モード）は番号・タイトルが入力欄になり、同じ行の右端に 上・下・✕ のアイコンが出る（T-017 / T-018 / T-021）。
 * 編集モード中は「＋カット」を出さない（シーンの操作とカットの操作を見分けやすくするため）
 */
export function SceneHeader({
	scene,
	onAddShot,
	disabled,
	edit,
}: {
	scene: Scene;
	onAddShot: () => void;
	disabled?: boolean;
	edit?: SceneEdit;
}) {
	const addShot = (
		<Button size="sm" onClick={onAddShot} disabled={disabled}>
			＋カット
		</Button>
	);

	if (!edit) {
		return (
			<div className="flex items-center gap-3">
				<h2 className="font-bold text-accent">
					S{scene.number}
					{scene.title && (
						<span className="ml-2 font-normal text-ink">{scene.title}</span>
					)}
				</h2>
				{addShot}
			</div>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span className="font-bold text-accent">S</span>
			<InlineField
				label="シーン番号"
				value={scene.number}
				required
				maxLength={20}
				onCommit={(number) => edit.onCommit({ number })}
				className="w-16 font-bold"
			/>
			<InlineField
				label="シーンのタイトル"
				value={scene.title}
				placeholder="タイトル"
				maxLength={200}
				onCommit={(title) => edit.onCommit({ title })}
				className="min-w-0 flex-1"
			/>
			<ItemActions
				variant="icon"
				isFirst={edit.isFirst}
				isLast={edit.isLast}
				onMove={edit.onMove}
				onDelete={edit.onDelete}
				disabled={edit.disabled}
			/>
		</div>
	);
}
