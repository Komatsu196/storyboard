import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useRef, useState } from "react";
import { changePassword } from "../api/client";
import { Button } from "./ui/Button";
import { fieldClass } from "./ui/field";

const MIN_LENGTH = 8;

/** 作品一覧の下の「パスワードを変更」と、今・新しい・もう一度を入れる <dialog>（T-037） */
export function ChangePasswordButton() {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [again, setAgain] = useState("");
	const [done, setDone] = useState(false);

	const mutation = useMutation({
		mutationFn: changePassword,
		onSuccess: (result) => {
			if (result === "ok") {
				setDone(true);
				dialogRef.current?.close();
			}
		},
	});

	const mismatch = again !== "" && again !== next;
	const canSubmit =
		current !== "" && next.length >= MIN_LENGTH && next === again;

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		mutation.mutate({ current, next });
	};

	return (
		<div className="mt-6 flex flex-col items-center gap-1">
			<Button
				variant="ghost"
				className="text-ink-muted"
				onClick={() => {
					setDone(false);
					dialogRef.current?.showModal();
				}}
			>
				パスワードを変更
			</Button>
			{done && <p className="text-ink-muted text-sm">変更しました</p>}
			<dialog
				ref={dialogRef}
				onClose={() => {
					setCurrent("");
					setNext("");
					setAgain("");
					mutation.reset();
				}}
				className="m-auto w-80 rounded-xl bg-surface p-5 text-ink shadow-lg backdrop:bg-black/40"
			>
				<form onSubmit={onSubmit} className="flex flex-col gap-3">
					<h2 className="font-bold">パスワードを変更</h2>
					<input
						type="password"
						autoComplete="current-password"
						value={current}
						onChange={(e) => setCurrent(e.target.value)}
						placeholder="今のパスワード"
						aria-label="今のパスワード"
						className={`${fieldClass(mutation.data === "wrong_password")} w-full`}
					/>
					<input
						type="password"
						autoComplete="new-password"
						value={next}
						onChange={(e) => setNext(e.target.value)}
						placeholder={`新しいパスワード（${MIN_LENGTH} 文字以上）`}
						aria-label="新しいパスワード"
						className={`${fieldClass()} w-full`}
					/>
					<input
						type="password"
						autoComplete="new-password"
						value={again}
						onChange={(e) => setAgain(e.target.value)}
						placeholder="もう一度"
						aria-label="新しいパスワード（もう一度）"
						className={`${fieldClass(mismatch)} w-full`}
					/>
					<div className="flex justify-end gap-2">
						<Button onClick={() => dialogRef.current?.close()}>
							キャンセル
						</Button>
						<Button
							type="submit"
							variant="primary"
							disabled={mutation.isPending || !canSubmit}
						>
							変更
						</Button>
					</div>
					{mutation.data === "wrong_password" && (
						<p className="text-danger text-sm">今のパスワードが違います</p>
					)}
					{mutation.isError && (
						<p className="text-danger text-sm">変更に失敗しました</p>
					)}
				</form>
			</dialog>
		</div>
	);
}
