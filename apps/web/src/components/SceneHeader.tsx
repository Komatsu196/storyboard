import { useRef, useState } from "react";
import type { Delta } from "../../shared/order";
import type { UpdateScene } from "../../shared/schemas";
import type { Scene } from "../api/client";
import { InlineField } from "./InlineField";
import { ItemActions } from "./ItemActions";
import { Button } from "./ui/Button";
import { fieldClass } from "./ui/field";

export type SceneEdit = {
	isFirst: boolean;
	isLast: boolean;
	onMove: (delta: Delta) => void;
	onDelete: () => void;
	disabled?: boolean;
};

/**
 * シーン見出し。edit があるとき（編集モード）は番号・タイトルが入力欄になり、同じ行の右端に 上・下・✕ のアイコンが出る（T-017 / T-018 / T-021）。
 * 編集モード中は「＋カット」を出さない（シーンの操作とカットの操作を見分けやすくするため）。
 * 通常モードでは見出しをタップするとタイトルだけがその場の入力欄になり、「＋カット」の位置に「保存」が出る（T-030）
 */
export function SceneHeader({
	scene,
	onAddShot,
	onCommit,
	disabled,
	edit,
}: {
	scene: Scene;
	onAddShot: () => void;
	onCommit: (input: UpdateScene) => void;
	disabled?: boolean;
	edit?: SceneEdit;
}) {
	if (!edit) {
		return (
			<TitleEditor
				scene={scene}
				onAddShot={onAddShot}
				onCommit={onCommit}
				disabled={disabled}
			/>
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
				onCommit={(number) => onCommit({ number })}
				className="w-16 font-bold"
			/>
			<InlineField
				label="シーンのタイトル"
				value={scene.title}
				placeholder="タイトル"
				maxLength={200}
				onCommit={(title) => onCommit({ title })}
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

/**
 * 通常モードの見出し（T-030）。保存は「保存」/ Enter / フォーカスが外れたとき のどれでも、入力欄の blur 1 か所で行う。
 * Esc だけは取り消して元のタイトルに戻す
 */
function TitleEditor({
	scene,
	onAddShot,
	onCommit,
	disabled,
}: {
	scene: Scene;
	onAddShot: () => void;
	onCommit: (input: UpdateScene) => void;
	disabled?: boolean;
}) {
	// null = 編集していない
	const [draft, setDraft] = useState<string | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	// Esc で閉じるときは blur で保存しない
	const cancelRef = useRef(false);

	if (draft === null) {
		return (
			<div className="flex items-center gap-3">
				<h2 className="min-w-0 font-bold text-accent">
					<button
						type="button"
						aria-label={`S${scene.number} のタイトルを編集`}
						onClick={() => setDraft(scene.title)}
						className="cursor-text rounded-sm text-left hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40"
					>
						S{scene.number}
						{scene.title && (
							<span className="ml-2 font-normal text-ink">{scene.title}</span>
						)}
					</button>
				</h2>
				<Button size="sm" onClick={onAddShot} disabled={disabled}>
					＋カット
				</Button>
			</div>
		);
	}

	const onBlur = () => {
		const next = draft.trim();
		const cancelled = cancelRef.current;
		cancelRef.current = false;
		setDraft(null);
		if (cancelled || next === scene.title) return;
		onCommit({ title: next });
	};

	return (
		<div className="flex items-center gap-2">
			<span className="shrink-0 font-bold text-accent">S{scene.number}</span>
			<input
				ref={inputRef}
				// biome-ignore lint/a11y/noAutofocus: 見出しをタップした直後に打ち始められるようにする（T-030）
				autoFocus
				aria-label="シーンのタイトル"
				value={draft}
				placeholder="タイトル"
				maxLength={200}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={onBlur}
				onKeyDown={(e) => {
					// 日本語入力の変換中の Enter（確定）・Esc（取り消し）では閉じない
					if (e.nativeEvent.isComposing) return;
					if (e.key === "Enter") e.currentTarget.blur();
					if (e.key === "Escape") {
						cancelRef.current = true;
						e.currentTarget.blur();
					}
				}}
				className={`${fieldClass()} min-w-0 flex-1`}
			/>
			<Button
				size="sm"
				variant="primary"
				// 押した瞬間に入力欄からフォーカスを外さず、クリックで blur させて保存の経路を 1 つにする
				onMouseDown={(e) => e.preventDefault()}
				onClick={() => inputRef.current?.blur()}
			>
				保存
			</Button>
		</div>
	);
}
