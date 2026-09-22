import type { QueryClient } from "@tanstack/react-query";
import type { SketchData } from "../../shared/sketch/types";
import {
	type ProjectDetail,
	projectQuery,
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
