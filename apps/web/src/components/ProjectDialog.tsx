import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FormEvent, useRef, useState } from "react";
import {
	type AspectRatio,
	aspectRatios,
	DEFAULT_ASPECT_RATIO,
} from "../../shared/schemas";
import { createProject, projectsQuery } from "../api/client";

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
			<button
				type="button"
				onClick={() => dialogRef.current?.showModal()}
				className="rounded bg-black px-3 py-2 text-sm text-white"
			>
				＋作品
			</button>
			<dialog
				ref={dialogRef}
				className="m-auto w-80 rounded-lg p-4 shadow-lg backdrop:bg-black/40"
			>
				<form onSubmit={onSubmit} className="flex flex-col gap-3">
					<h2 className="font-bold">新しい作品</h2>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="タイトル"
						aria-label="タイトル"
						className="rounded border px-3 py-2"
					/>
					<label className="flex items-center justify-between text-sm">
						アスペクト比
						<select
							value={aspectRatio}
							onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
							className="rounded border px-2 py-1"
						>
							{aspectRatios.map((r) => (
								<option key={r} value={r}>
									{r}
								</option>
							))}
						</select>
					</label>
					<div className="flex justify-end gap-2">
						<button
							type="button"
							onClick={() => dialogRef.current?.close()}
							className="rounded border px-3 py-2 text-sm"
						>
							キャンセル
						</button>
						<button
							type="submit"
							disabled={mutation.isPending || title.trim() === ""}
							className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-40"
						>
							作成
						</button>
					</div>
					{mutation.isError && (
						<p className="text-red-600 text-sm">作成に失敗しました</p>
					)}
				</form>
			</dialog>
		</>
	);
}
