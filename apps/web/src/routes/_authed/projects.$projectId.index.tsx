import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Plus } from "lucide-react";
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
import { Button, buttonClass } from "../../components/ui/Button";
import { fieldClass } from "../../components/ui/field";
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
			{/* ページ上部はスクロールしても上端に残す（T-031）。高さを h-16 に固定し、シーン見出しはその下（top-16）に貼り付く */}
			<header className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 flex h-16 items-center gap-2 border-line border-b bg-canvas px-4">
				<Link
					to="/"
					className={`${buttonClass({ variant: "ghost" })} shrink-0`}
				>
					<ChevronLeft aria-hidden className="size-5 shrink-0" />
					作品一覧
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
							className={`${fieldClass()} shrink-0 text-sm`}
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
						<span className="shrink-0 text-ink-muted text-sm">
							{project.aspectRatio}
						</span>
					</>
				)}
				<Button
					variant={editing ? "primary" : "secondary"}
					onClick={() => setEditing((v) => !v)}
					className="shrink-0"
				>
					{editing ? "完了" : "編集"}
				</Button>
			</header>
			{structure.error && (
				<p role="alert" className="mb-4 text-danger text-sm">
					{structure.error}
				</p>
			)}

			{project.scenes.length === 0 && (
				<p className="mb-4 text-ink-muted">シーンがありません</p>
			)}
			{project.scenes.map((scene, i) => (
				<section
					key={scene.id}
					className="mb-4 overflow-clip rounded-xl border border-line bg-surface"
				>
					{/* シーン見出しはカード上端の帯（T-025）。帯の色は差し色の薄い藍（D-017）。
					    そのシーンが見えている間はページ上部の下に貼り付く（T-031。sticky を効かせるためカードは overflow-hidden ではなく overflow-clip） */}
					<div className="sticky top-16 z-10 border-line border-b bg-accent-soft px-3 py-2">
						<SceneHeader
							scene={scene}
							onAddShot={() => addShot.mutate(scene.id)}
							onCommit={(input) => structure.updateScene(scene.id, input)}
							disabled={busy}
							edit={
								editing
									? {
											isFirst: i === 0,
											isLast: i === project.scenes.length - 1,
											onMove: (delta) => structure.moveScene(scene.id, delta),
											onDuplicate: () => structure.duplicateScene(scene.id),
											onDelete: () => structure.deleteScene(scene),
											disabled: structure.deleting,
										}
									: undefined
							}
						/>
					</div>
					<div className="p-3">
						<ShotGrid
							projectId={project.id}
							aspectRatio={aspectRatio}
							shots={scene.shots}
							edit={
								editing
									? {
											onMove: (shotId, delta) =>
												structure.moveShot(scene.id, shotId, delta),
											onDuplicate: structure.duplicateShot,
											onDelete: structure.deleteShot,
											disabled: structure.deleting,
										}
									: undefined
							}
						/>
					</div>
				</section>
			))}

			<div className="flex flex-wrap gap-2">
				<NewSceneForm
					projectId={project.id}
					disabled={busy}
					onPendingChange={setCreatingScene}
				/>
				{project.scenes.length === 0 && (
					<Button onClick={() => addShot.mutate(undefined)} disabled={busy}>
						＋カット
					</Button>
				)}
			</div>
			{addShot.isError && (
				<p className="mt-2 text-danger text-sm">
					作成に失敗しました。もう一度試してください。
				</p>
			)}
			{editing && (
				<Button
					variant="danger"
					onClick={() => structure.deleteProject(project.title)}
					disabled={structure.deleting}
					className="mt-8"
				>
					この作品を削除
				</Button>
			)}

			{/* スマホ用: 画面下に固定の「＋カット」（最後のシーンに追加。シーンが無ければ作る）。この画面の primary（T-026） */}
			<Button
				variant="primary"
				size="lg"
				pill
				icon={Plus}
				aria-label="＋カット"
				onClick={() => addShot.mutate(undefined)}
				disabled={busy}
				className="fixed right-4 bottom-4 z-30 shadow-lg md:hidden"
			>
				カット
			</Button>
		</main>
	);
}
