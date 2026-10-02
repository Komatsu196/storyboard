import type { QueryClient } from "@tanstack/react-query";
import { type Delta, moveItem } from "../../shared/order";
import type {
	ShotFields,
	UpdateProject,
	UpdateScene,
} from "../../shared/schemas";
import type { SketchData } from "../../shared/sketch/types";
import {
	type ProjectDetail,
	projectQuery,
	projectsQuery,
	type Scene,
	type Shot,
} from "./client";

function updateProject(
	queryClient: QueryClient,
	projectId: string,
	update: (project: ProjectDetail) => ProjectDetail,
): void {
	queryClient.setQueryData(projectQuery(projectId).queryKey, (old) =>
		old ? update(old) : old,
	);
}

/** 「＋シーン」の応答を末尾に差し込む（再取得しない。設計書 §5.2） */
export function appendScene(
	queryClient: QueryClient,
	projectId: string,
	scene: Scene,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: [...p.scenes, scene],
	}));
}

/** 「＋カット」の応答をそのシーンの末尾に差し込む */
export function appendShot(
	queryClient: QueryClient,
	projectId: string,
	sceneId: string,
	shot: Shot,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.map((s) =>
			s.id === sceneId ? { ...s, shots: [...s.shots, shot] } : s,
		),
	}));
}

/** 配列の id の項目のすぐ後ろに item を入れる。見つからなければ引数の配列そのものを返す */
function insertAfter<T extends { id: string }>(
	items: T[],
	id: string,
	item: T,
): T[] {
	const i = items.findIndex((x) => x.id === id);
	return i < 0
		? items
		: [...items.slice(0, i + 1), item, ...items.slice(i + 1)];
}

/** シーンの複製（T-033）の応答を、元のシーンのすぐ後ろに差し込む */
export function insertSceneAfter(
	queryClient: QueryClient,
	projectId: string,
	sourceId: string,
	scene: Scene,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: insertAfter(p.scenes, sourceId, scene),
	}));
}

/** カットの複製（T-032）の応答を、同じシーンの元のカットのすぐ後ろに差し込む */
export function insertShotAfter(
	queryClient: QueryClient,
	projectId: string,
	sourceId: string,
	shot: Shot,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.map((s) => {
			const shots = insertAfter(s.shots, sourceId, shot);
			return shots === s.shots ? s : { ...s, shots };
		}),
	}));
}

/** エディタのストローク確定・保存完了のたびに呼び、作品ページのサムネイルを最新にする */
export function setShotSketch(
	queryClient: QueryClient,
	projectId: string,
	shotId: string,
	sketch: SketchData,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.map((s) => ({
			...s,
			shots: s.shots.map((sh) => (sh.id === shotId ? { ...sh, sketch } : sh)),
		})),
	}));
}

/** 入力のたび・PATCH 成功のたびに呼び、カット行の 7 項目（＋updatedAt）を更新する。sketch は触らない */
export function setShotFields(
	queryClient: QueryClient,
	projectId: string,
	shotId: string,
	fields: Partial<ShotFields> & { updatedAt?: string },
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.map((s) => ({
			...s,
			shots: s.shots.map((sh) =>
				sh.id === shotId ? { ...sh, ...fields } : sh,
			),
		})),
	}));
}

/** 作品名・アスペクト比を作品ページのキャッシュに書く（T-019。送信前の楽観的更新） */
export function setProjectFields(
	queryClient: QueryClient,
	projectId: string,
	fields: UpdateProject,
): void {
	updateProject(queryClient, projectId, (p) => ({ ...p, ...fields }));
}

/** 作品一覧のキャッシュにも同じ変更を書く（一覧に戻ったときすぐ反映する） */
export function setProjectListFields(
	queryClient: QueryClient,
	projectId: string,
	fields: UpdateProject,
): void {
	queryClient.setQueryData(projectsQuery.queryKey, (old) =>
		old?.map((p) => (p.id === projectId ? { ...p, ...fields } : p)),
	);
}

/** 作品を削除したら一覧のキャッシュから除く（一覧へ戻ったとき消えた作品が一瞬見えないように） */
export function removeProjectFromList(
	queryClient: QueryClient,
	projectId: string,
): void {
	queryClient.setQueryData(projectsQuery.queryKey, (old) =>
		old?.filter((p) => p.id !== projectId),
	);
}

/** シーンの番号・タイトルを書く（T-018。送信前の楽観的更新） */
export function setSceneFields(
	queryClient: QueryClient,
	projectId: string,
	sceneId: string,
	fields: UpdateScene,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, ...fields } : s)),
	}));
}

export function removeScene(
	queryClient: QueryClient,
	projectId: string,
	sceneId: string,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.filter((s) => s.id !== sceneId),
	}));
}

export function removeShot(
	queryClient: QueryClient,
	projectId: string,
	shotId: string,
): void {
	updateProject(queryClient, projectId, (p) => ({
		...p,
		scenes: p.scenes.map((s) => ({
			...s,
			shots: s.shots.filter((sh) => sh.id !== shotId),
		})),
	}));
}

/**
 * シーンを前へ / 後へ動かす（T-017。楽観的更新）。
 * 並べ替えた後のシーンの ids（PUT …/order にそのまま送る）を返す。変化がなければ null を返し、キャッシュも触らない。
 */
export function moveScene(
	queryClient: QueryClient,
	projectId: string,
	sceneId: string,
	delta: Delta,
): string[] | null {
	const key = projectQuery(projectId).queryKey;
	const project = queryClient.getQueryData(key);
	if (!project) return null;
	const scenes = moveItem(project.scenes, sceneId, delta);
	if (scenes === project.scenes) return null;
	queryClient.setQueryData(key, { ...project, scenes });
	return scenes.map((s) => s.id);
}

/** カットをシーンの中で前へ / 後へ動かす。返り値は moveScene と同じ（そのシーンのカットの ids か null） */
export function moveShot(
	queryClient: QueryClient,
	projectId: string,
	sceneId: string,
	shotId: string,
	delta: Delta,
): string[] | null {
	const key = projectQuery(projectId).queryKey;
	const project = queryClient.getQueryData(key);
	const scene = project?.scenes.find((s) => s.id === sceneId);
	if (!project || !scene) return null;
	const shots = moveItem(scene.shots, shotId, delta);
	if (shots === scene.shots) return null;
	queryClient.setQueryData(key, {
		...project,
		scenes: project.scenes.map((s) => (s.id === sceneId ? { ...s, shots } : s)),
	});
	return shots.map((s) => s.id);
}
