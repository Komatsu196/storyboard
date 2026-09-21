import {
	useMutation,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toAspectRatio } from "../../../shared/schemas";
import { appendScene, appendShot } from "../../api/cache";
import { createScene, createShot, projectQuery } from "../../api/client";
import { SceneHeader } from "../../components/SceneHeader";
import { ShotGrid } from "../../components/ShotGrid";

export const Route = createFileRoute("/_authed/projects/$projectId/")({
	component: ProjectPage,
});

function ProjectPage() {
	const { projectId } = Route.useParams();
	const { data: project } = useSuspenseQuery(projectQuery(projectId));
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const aspectRatio = toAspectRatio(project.aspectRatio);

	const addScene = useMutation({
		mutationFn: () => createScene(project.id),
		onSuccess: (scene) => appendScene(queryClient, project.id, scene),
	});

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
	const busy = addScene.isPending || addShot.isPending;

	return (
		<main className="p-4 pb-24 md:pb-4">
			<header className="mb-4 flex items-center gap-3">
				<Link to="/" className="shrink-0 text-sm underline">
					← 作品一覧
				</Link>
				<h1 className="truncate font-bold text-xl">{project.title}</h1>
				<span className="shrink-0 text-gray-500 text-sm">
					{project.aspectRatio}
				</span>
			</header>

			{project.scenes.length === 0 && (
				<p className="mb-4 text-gray-500">シーンがありません</p>
			)}
			{project.scenes.map((scene) => (
				<section key={scene.id} className="mb-6">
					<SceneHeader
						scene={scene}
						onAddShot={() => addShot.mutate(scene.id)}
						disabled={busy}
					/>
					<ShotGrid
						projectId={project.id}
						aspectRatio={aspectRatio}
						shots={scene.shots}
					/>
				</section>
			))}

			<div className="flex gap-2">
				<button
					type="button"
					onClick={() => addScene.mutate()}
					disabled={busy}
					className="rounded border px-3 py-2 disabled:opacity-40"
				>
					＋シーン
				</button>
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
