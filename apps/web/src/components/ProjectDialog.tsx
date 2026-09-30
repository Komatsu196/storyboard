import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import {
	type AspectRatio,
	aspectRatios,
	DEFAULT_ASPECT_RATIO,
} from "../../shared/schemas";
import { createProject, projectsQuery } from "../api/client";
import { Button } from "./ui/Button";
import { fieldClass } from "./ui/field";

/** 「＋作品」ボタンと、タイトル＋アスペクト比を入れる <dialog> */
export function NewProjectButton() {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const [title, setTitle] = useState("");
	const [aspectRatio, setAspectRatio] =
		useState<AspectRatio>(DEFAULT_ASPECT_RATIO);
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const mutation = useMutation({
		mutationFn: createProject,
		onSuccess: async (project) => {
			await queryClient.invalidateQueries({ queryKey: projectsQuery.queryKey });
			dialogRef.current?.close();
			await navigate({
				to: "/projects/$projectId",
				params: { projectId: project.id },
			});
		},
	});

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		mutation.mutate({ title: title.trim(), aspectRatio });
	};

	return (
		<>
			<Button variant="primary" onClick={() => dialogRef.current?.showModal()}>
				＋作品
			</Button>
			<dialog
				ref={dialogRef}
				onClose={() => {
					setTitle("");
					setAspectRatio(DEFAULT_ASPECT_RATIO);
					mutation.reset();
				}}
				className="m-auto w-80 rounded-xl bg-surface p-5 text-ink shadow-lg backdrop:bg-black/40"
			>
				<form onSubmit={onSubmit} className="flex flex-col gap-3">
					<h2 className="font-bold">新しい作品</h2>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="タイトル"
						aria-label="タイトル"
						className={`${fieldClass()} w-full`}
					/>
					<label className="flex items-center justify-between text-sm">
						アスペクト比
						<select
							value={aspectRatio}
							onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
							className={fieldClass()}
						>
							{aspectRatios.map((r) => (
								<option key={r} value={r}>
									{r}
								</option>
							))}
						</select>
					</label>
					<div className="flex justify-end gap-2">
						<Button onClick={() => dialogRef.current?.close()}>
							キャンセル
						</Button>
						<Button
							type="submit"
							variant="primary"
							disabled={mutation.isPending || title.trim() === ""}
						>
							作成
						</Button>
					</div>
					{mutation.isError && (
						<p className="text-danger text-sm">作成に失敗しました</p>
					)}
				</form>
			</dialog>
		</>
	);
}
