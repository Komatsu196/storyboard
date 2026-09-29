import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { appendScene } from "../api/cache";
import { createScene } from "../api/client";

const button = "min-h-11 rounded border px-3 disabled:opacity-40";

/**
 * 作品ページ末尾の「＋シーン」（T-022、設計書 §5.6）。押すとその場でタイトル（任意）の入力欄＋「追加」「やめる」に変わる。
 * Enter / 「追加」で作成してボタンに戻る。空のままでも作れる。「やめる」/ Esc で何も作らずに戻る。
 * onPendingChange は作品ページの「＋カット」を送信中に止めるために使う
 */
export function NewSceneForm({
	projectId,
	disabled = false,
	onPendingChange,
}: {
	projectId: string;
	disabled?: boolean;
	onPendingChange?: (pending: boolean) => void;
}) {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");

	const mutation = useMutation({
		mutationFn: (t: string) => createScene(projectId, t),
		onMutate: () => onPendingChange?.(true),
		onSettled: () => onPendingChange?.(false),
		onSuccess: (scene) => {
			appendScene(queryClient, projectId, scene);
			setTitle("");
			setOpen(false);
		},
	});

	const close = () => {
		setTitle("");
		setOpen(false);
		mutation.reset();
	};

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				disabled={disabled}
				className={button}
			>
				＋シーン
			</button>
		);
	}

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		mutation.mutate(title.trim());
	};

	return (
		<form onSubmit={onSubmit} className="flex w-full flex-col gap-1">
			<div className="flex gap-2">
				<input
					// biome-ignore lint/a11y/noAutofocus: 「＋シーン」を押した直後に打ち始められるようにする（T-022）
					autoFocus
					aria-label="新しいシーンのタイトル"
					placeholder="タイトル（任意）"
					value={title}
					maxLength={200}
					disabled={mutation.isPending}
					onChange={(e) => setTitle(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") close();
					}}
					className="min-h-11 min-w-0 flex-1 rounded border px-2"
				/>
				<button type="submit" disabled={mutation.isPending} className={button}>
					追加
				</button>
				<button
					type="button"
					onClick={close}
					disabled={mutation.isPending}
					className={button}
				>
					やめる
				</button>
			</div>
			{mutation.isError && (
				<p className="text-red-600 text-sm">
					作成に失敗しました。もう一度試してください。
				</p>
			)}
		</form>
	);
}
