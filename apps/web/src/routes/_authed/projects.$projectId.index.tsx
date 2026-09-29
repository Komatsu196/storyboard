import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
	type AspectRatio,
	aspectRatios,
	toAspectRatio,
} from "../../../shared/schemas";
import { appendScene, appendShot } from "../../api/cache";
import { createScene, createShot, projectQuery } from "../../api/client";
import { InlineField } from "../../components/InlineField";
import { NewSceneForm } from "../../components/NewSceneForm";
import { SceneHeader } from "../../components/SceneHeader";
import { ShotGrid } from "../../components/ShotGrid";
import { useStructureMutations } from "../../components/useStructureMutations";

export const Route = createFileRoute("/_authed/projects/$projectId/")({
	component: ProjectPage,
});

function ProjectPage() {
	const { projectId } = Route.useParams();
	const { data: project } = useSuspenseQuery(projectQuery(projectId));
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const aspectRatio = toAspectRatio(project.aspectRatio);
	// 編集モード（T-017）。保存しない。ページを離れると OFF に戻る
	const [editing, setEditing] = useState(false);
	const structure = useStructureMutations(project.id);

	// ＋シーンの送信中（NewSceneForm から受け取る）。送信中は ＋カット を止める
	const [creatingScene, setCreatingScene] = useState(false);

	// 「＋カット → 即エディタ」。sceneId 省略時は最後のシーン（無ければ作ってから）
	const addShot = useMutation({
		mutationFn: async (sceneId: string | undefined) => {
			let targetId = sceneId ?? project.scenes.at(-1)?.id;
			if (!targetId) {
				const scene = await createScene(project.id);
				appendScene(queryClient, project.id, scene);
				targetId = scene.id;
			}
			const shot = await createShot(targetId);
			appendShot(queryClient, project.id, targetId, shot);
			return shot;
		},
		onSuccess: (shot) =>
			navigate({
				to: "/projects/$projectId/shots/$shotId",
				params: { projectId: project.id, shotId: shot.id },
			}),
	});
	const busy = creatingScene || addShot.isPending;

	return (
		<main className="p-4 pb-24 md:pb-4">
			<header className="mb-4 flex items-center gap-3">
				<Link to="/" className="shrink-0 text-sm underline">
					← 作品一覧
				</Link>
				{editing ? (
					<>
						<InlineField
							label="作品名"
							value={project.title}
							required
							maxLength={200}
							onCommit={structure.renameProject}
							className="min-w-0 flex-1 font-bold text-xl"
						/>
						<select
							aria-label="アスペクト比"
							value={aspectRatio}
							onChange={(e) =>
								structure.changeAspectRatio(e.target.value as AspectRatio)
							}
							className="min-h-11 shrink-0 rounded border px-2 text-sm"
						>
							{aspectRatios.map((r) => (
								<option key={r} value={r}>
									{r}
								</option>
							))}
						</select>
					</>
				) : (
					<>
						<h1 className="min-w-0 flex-1 truncate font-bold text-xl">
							{project.title}
						</h1>
						<span className="shrink-0 text-gray-500 text-sm">
							{project.aspectRatio}
						</span>
					</>
				)}
				<button
					type="button"
					onClick={() => setEditing((v) => !v)}
					className="min-h-11 shrink-0 rounded border px-3 text-sm"
				>
					{editing ? "完了" : "編集"}
				</button>
			</header>
			{structure.error && (
				<p role="alert" className="mb-4 text-red-600 text-sm">
					{structure.error}
				</p>
			)}

			{project.scenes.length === 0 && (
				<p className="mb-4 text-gray-500">シーンがありません</p>
			)}
			{project.scenes.map((scene, i) => (
				<section key={scene.id} className="mb-6">
					<SceneHeader
						scene={scene}
						onAddShot={() => addShot.mutate(scene.id)}
						disabled={busy}
						edit={
							editing
								? {
										isFirst: i === 0,
										isLast: i === project.scenes.length - 1,
										onMove: (delta) => structure.moveScene(scene.id, delta),
										onDelete: () => structure.deleteScene(scene),
										onCommit: (input) => structure.updateScene(scene.id, input),
										disabled: structure.deleting,
									}
								: undefined
						}
					/>
					<ShotGrid
						projectId={project.id}
						aspectRatio={aspectRatio}
						shots={scene.shots}
						edit={
							editing
								? {
										onMove: (shotId, delta) =>
											structure.moveShot(scene.id, shotId, delta),
										onDelete: structure.deleteShot,
										disabled: structure.deleting,
									}
								: undefined
						}
					/>
				</section>
			))}

			<div className="flex flex-wrap gap-2">
				<NewSceneForm
					projectId={project.id}
					disabled={busy}
					onPendingChange={setCreatingScene}
				/>
				{project.scenes.length === 0 && (
					<button
						type="button"
						onClick={() => addShot.mutate(undefined)}
						disabled={busy}
						className="rounded border px-3 py-2 disabled:opacity-40"
					>
						＋カット
					</button>
				)}
			</div>
			{addShot.isError && (
				<p className="mt-2 text-red-600 text-sm">
					作成に失敗しました。もう一度試してください。
				</p>
			)}
			{editing && (
				<button
					type="button"
					onClick={() => structure.deleteProject(project.title)}
					disabled={structure.deleting}
					className="mt-8 block min-h-11 rounded border border-red-600 px-3 text-red-600 disabled:opacity-40"
				>
					この作品を削除
				</button>
			)}

			{/* スマホ用: 画面下に固定の「＋カット」（最後のシーンに追加。シーンが無ければ作る） */}
			<button
				type="button"
				onClick={() => addShot.mutate(undefined)}
				disabled={busy}
				className="fixed right-4 bottom-4 rounded-full bg-black px-5 py-3 font-bold text-white shadow-lg disabled:opacity-40 md:hidden"
			>
				＋カット
			</button>
		</main>
	);
}
