import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { appendScene } from "../api/cache";
import { createScene } from "../api/client";
import { Button } from "./ui/Button";
import { fieldClass } from "./ui/field";

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
			<Button onClick={() => setOpen(true)} disabled={disabled}>
				＋シーン
			</Button>
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
						// 日本語入力の変換中の Esc（変換の取り消し）では閉じない
						if (e.key === "Escape" && !e.nativeEvent.isComposing) close();
					}}
					className={`${fieldClass()} min-w-0 flex-1`}
				/>
				<Button type="submit" disabled={mutation.isPending}>
					追加
				</Button>
				<Button variant="ghost" onClick={close} disabled={mutation.isPending}>
					やめる
				</Button>
			</div>
			{mutation.isError && (
				<p className="text-danger text-sm">
					作成に失敗しました。もう一度試してください。
				</p>
			)}
		</form>
	);
}
