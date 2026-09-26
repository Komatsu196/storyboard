import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { Delta } from "../../shared/order";
import type {
	AspectRatio,
	UpdateProject,
	UpdateScene,
} from "../../shared/schemas";
import {
	moveScene as moveSceneInCache,
	moveShot as moveShotInCache,
	removeProjectFromList,
	removeScene,
	removeShot,
	setProjectFields,
	setProjectListFields,
	setSceneFields,
} from "../api/cache";
import {
	deleteProject,
	deleteScene,
	deleteShot,
	patchProject,
	patchScene,
	projectQuery,
	projectsQuery,
	putSceneOrder,
	putShotOrder,
	type Scene,
	type Shot,
} from "../api/client";

type OrderRequest =
	| { kind: "scenes"; ids: string[] }
	| { kind: "shots"; sceneId: string; ids: string[] };

/**
 * 作品ページの編集モードの操作（T-017〜T-020、設計書 §5.5）。
 * - 並べ替えと名前の変更は、キャッシュを先に書き換えてから送る（楽観的更新）。失敗したら巻き戻さずに作品を取り直す。
 * - 並べ替えは scope で直列に流し、連打しても最後の並びが最後に届くようにする。
 * - 削除は confirm() の後に送り、成功したらキャッシュから除く。
 */
export function useStructureMutations(projectId: string) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const projectKey = projectQuery(projectId).queryKey;

	const failed = (message: string) => () => {
		setError(message);
		void queryClient.invalidateQueries({ queryKey: projectKey });
		void queryClient.invalidateQueries({ queryKey: projectsQuery.queryKey });
	};

	const order = useMutation({
		scope: { id: `order:${projectId}` },
		mutationFn: (req: OrderRequest) =>
			req.kind === "scenes"
				? putSceneOrder(projectId, req.ids)
				: putShotOrder(req.sceneId, req.ids),
		onError: failed("並べ替えに失敗しました"),
	});

	const projectPatch = useMutation({
		scope: { id: `project:${projectId}` },
		mutationFn: (input: UpdateProject) => patchProject(projectId, input),
		onSuccess: (_row, input) =>
			// アスペクト比の変更はサーバーがスケッチを書き換えるので取り直す（T-020）
			input.aspectRatio === undefined
				? undefined
				: queryClient.invalidateQueries({ queryKey: projectKey }),
		onError: failed("保存に失敗しました"),
	});

	const scenePatch = useMutation({
		mutationFn: (v: { sceneId: string; input: UpdateScene }) =>
			patchScene(v.sceneId, v.input),
		onError: failed("保存に失敗しました"),
	});

	const sceneDelete = useMutation({
		mutationFn: deleteScene,
		onSuccess: (_, sceneId) => removeScene(queryClient, projectId, sceneId),
		onError: failed("削除に失敗しました"),
	});

	const shotDelete = useMutation({
		mutationFn: deleteShot,
		onSuccess: (_, shotId) => removeShot(queryClient, projectId, shotId),
		onError: failed("削除に失敗しました"),
	});

	const projectDelete = useMutation({
		mutationFn: () => deleteProject(projectId),
		onSuccess: async () => {
			removeProjectFromList(queryClient, projectId);
			await navigate({ to: "/" });
			// 作品ページを離れてから消す（先に消すと、表示中の useSuspenseQuery が取り直して 404 になる）
			queryClient.removeQueries({ queryKey: projectKey });
		},
		onError: failed("削除に失敗しました"),
	});

	const updateProjectFields = (input: UpdateProject) => {
		setError(null);
		void queryClient.cancelQueries({ queryKey: projectKey });
		setProjectFields(queryClient, projectId, input);
		setProjectListFields(queryClient, projectId, input);
		projectPatch.mutate(input);
	};

	return {
		error,
		deleting:
			sceneDelete.isPending || shotDelete.isPending || projectDelete.isPending,
		moveScene: (sceneId: string, delta: Delta) => {
			setError(null);
			void queryClient.cancelQueries({ queryKey: projectKey });
			const ids = moveSceneInCache(queryClient, projectId, sceneId, delta);
			if (ids) order.mutate({ kind: "scenes", ids });
		},
		moveShot: (sceneId: string, shotId: string, delta: Delta) => {
			setError(null);
			void queryClient.cancelQueries({ queryKey: projectKey });
			const ids = moveShotInCache(
				queryClient,
				projectId,
				sceneId,
				shotId,
				delta,
			);
			if (ids) order.mutate({ kind: "shots", sceneId, ids });
		},
		renameProject: (title: string) => updateProjectFields({ title }),
		changeAspectRatio: (aspectRatio: AspectRatio) =>
			updateProjectFields({ aspectRatio }),
		updateScene: (sceneId: string, input: UpdateScene) => {
			setError(null);
			void queryClient.cancelQueries({ queryKey: projectKey });
			setSceneFields(queryClient, projectId, sceneId, input);
			scenePatch.mutate({ sceneId, input });
		},
		deleteScene: (scene: Scene) => {
			const message =
				scene.shots.length === 0
					? `S${scene.number} を削除しますか？`
					: `S${scene.number} と、その中のカット ${scene.shots.length} 個を削除します。元に戻せません。`;
			if (!window.confirm(message)) return;
			setError(null);
			sceneDelete.mutate(scene.id);
		},
		deleteShot: (shot: Shot) => {
			if (!window.confirm(`C${shot.number} を削除しますか？`)) return;
			setError(null);
			shotDelete.mutate(shot.id);
		},
		deleteProject: (title: string) => {
			if (
				!window.confirm(
					`「${title}」を削除します。シーン・カット・スケッチもすべて消え、元に戻せません。`,
				)
			)
				return;
			setError(null);
			projectDelete.mutate();
		},
	};
}
