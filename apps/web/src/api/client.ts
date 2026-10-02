import { queryOptions } from "@tanstack/react-query";
import { hc, type InferResponseType } from "hono/client";
import type { AppType } from "../../server/app";
import type {
	AspectRatio,
	ShotFields,
	UpdateProject,
	UpdateScene,
} from "../../shared/schemas";
import type { SketchData } from "../../shared/sketch/types";

// セッション切れの 401 はログイン画面へ送る。
// /api/login の 401（パスワード不一致）と /api/session の 401（認証ゲートが扱う）は除く。
const fetchWithLoginRedirect: typeof fetch = async (input, init) => {
	const res = await fetch(input, init);
	if (
		res.status === 401 &&
		!/\/api\/(login|session)$/.test(res.url) &&
		!location.pathname.startsWith("/login")
	) {
		const redirect = encodeURIComponent(location.pathname + location.search);
		location.assign(`/login?redirect=${redirect}`);
	}
	return res;
};

export const api = hc<AppType>("/", { fetch: fetchWithLoginRedirect }).api;

export type Project = InferResponseType<typeof api.projects.$get, 200>[number];
export type ProjectDetail = InferResponseType<
	(typeof api.projects)[":id"]["$get"],
	200
>;
export type Scene = ProjectDetail["scenes"][number];
export type Shot = Scene["shots"][number];

/** PATCH の応答（カット行。sketch は含まない） */
export type ShotRow = InferResponseType<
	(typeof api.shots)[":id"]["$patch"],
	200
>;

/** PATCH /api/scenes/:id の応答（シーン行。shots は含まない） */
export type SceneRow = InferResponseType<
	(typeof api.scenes)[":id"]["$patch"],
	200
>;

export class NotFoundError extends Error {
	constructor() {
		super("not found");
		this.name = "NotFoundError";
	}
}

export const sessionQuery = queryOptions({
	queryKey: ["session"],
	queryFn: async () => {
		const res = await api.session.$get();
		if (res.status === 401) return { loggedIn: false as const };
		if (!res.ok) throw new Error(`session check failed: ${res.status}`);
		return { loggedIn: true as const };
	},
	staleTime: 5 * 60 * 1000,
});

export const projectsQuery = queryOptions({
	queryKey: ["projects"],
	queryFn: async () => {
		const res = await api.projects.$get();
		if (res.status !== 200) throw new Error(`projects: ${res.status}`);
		return res.json();
	},
});

export const projectQuery = (id: string) =>
	queryOptions({
		queryKey: ["project", id],
		queryFn: async () => {
			const res = await api.projects[":id"].$get({ param: { id } });
			if (res.status !== 200) {
				throw res.status === 404
					? new NotFoundError()
					: new Error(`project: ${res.status}`);
			}
			return res.json();
		},
		// 自分しか書かないので 30 秒は再取得しない（エディタの setQueryData を古いデータで上書きしにくくする）
		staleTime: 30 * 1000,
		retry: (count, error) => !(error instanceof NotFoundError) && count < 2,
	});

export async function login(password: string): Promise<boolean> {
	const res = await api.login.$post({ json: { password } });
	return res.status === 204;
}

export async function logout(): Promise<void> {
	await api.logout.$post();
}

export async function createProject(input: {
	title: string;
	aspectRatio: AspectRatio;
}): Promise<Project> {
	const res = await api.projects.$post({ json: input });
	if (res.status !== 201) throw new Error(`create project: ${res.status}`);
	return res.json();
}

/** 「＋シーン」。title は任意（T-022。空なら「タイトルなし」、番号はサーバーが採番） */
export async function createScene(
	projectId: string,
	title = "",
): Promise<Scene> {
	const res = await api.projects[":id"].scenes.$post({
		param: { id: projectId },
		json: { title },
	});
	if (res.status !== 201) throw new Error(`create scene: ${res.status}`);
	return { ...(await res.json()), shots: [] };
}

export async function createShot(sceneId: string): Promise<Shot> {
	const res = await api.scenes[":id"].shots.$post({ param: { id: sceneId } });
	if (res.status !== 201) throw new Error(`create shot: ${res.status}`);
	return res.json();
}

/** keepalive の fetch は本文 64KB までをカット情報の PATCH と共有するので、大きいスケッチは通常送信に落とす */
export async function putSketch(
	shotId: string,
	data: SketchData,
	opts: { keepalive: boolean },
): Promise<void> {
	const keepalive = opts.keepalive && JSON.stringify(data).length < 54_000;
	const res = await api.shots[":id"].sketch.$put(
		{ param: { id: shotId }, json: data },
		{ init: { keepalive } },
	);
	if (res.status !== 204) {
		// 400（検証エラー）は単一ユーザーの UI では原則起きない。起きたら中身をコンソールに残す（設計書 §7）
		console.error("put sketch failed", res.status, await res.text());
		throw new Error(`put sketch: ${res.status}`);
	}
}

/** カット情報 7 項目をまとめて保存する（T-011）。keepalive は離脱時の flush 用（本文は小さいので常に可） */
export async function patchShot(
	shotId: string,
	fields: ShotFields,
	opts: { keepalive: boolean },
): Promise<ShotRow> {
	const res = await api.shots[":id"].$patch(
		{ param: { id: shotId }, json: fields },
		{ init: { keepalive: opts.keepalive } },
	);
	if (res.status !== 200) {
		// 400（検証エラー）は単一ユーザーの UI では原則起きない。起きたら中身をコンソールに残す（設計書 §7）
		console.error("patch shot failed", res.status, await res.text());
		throw new Error(`patch shot: ${res.status}`);
	}
	return res.json();
}

export async function patchProject(
	id: string,
	input: UpdateProject,
): Promise<Project> {
	const res = await api.projects[":id"].$patch({ param: { id }, json: input });
	if (res.status !== 200) throw new Error(`patch project: ${res.status}`);
	return res.json();
}

export async function deleteProject(id: string): Promise<void> {
	const res = await api.projects[":id"].$delete({ param: { id } });
	if (res.status !== 204) throw new Error(`delete project: ${res.status}`);
}

export async function patchScene(
	id: string,
	input: UpdateScene,
): Promise<SceneRow> {
	const res = await api.scenes[":id"].$patch({ param: { id }, json: input });
	if (res.status !== 200) throw new Error(`patch scene: ${res.status}`);
	return res.json();
}

export async function deleteScene(id: string): Promise<void> {
	const res = await api.scenes[":id"].$delete({ param: { id } });
	if (res.status !== 204) throw new Error(`delete scene: ${res.status}`);
}

export async function deleteShot(id: string): Promise<void> {
	const res = await api.shots[":id"].$delete({ param: { id } });
	if (res.status !== 204) throw new Error(`delete shot: ${res.status}`);
}

/** 複製（T-032）。元のすぐ後ろに入ったコピー（スケッチ付き）を返す */
export async function duplicateShot(id: string): Promise<Shot> {
	const res = await api.shots[":id"].duplicate.$post({ param: { id } });
	if (res.status !== 201) throw new Error(`duplicate shot: ${res.status}`);
	return res.json();
}

/** 複製（T-033）。元のすぐ後ろに入ったコピー（カット付き）を返す */
export async function duplicateScene(id: string): Promise<Scene> {
	const res = await api.scenes[":id"].duplicate.$post({ param: { id } });
	if (res.status !== 201) throw new Error(`duplicate scene: ${res.status}`);
	return res.json();
}

/** 並べ替え（T-017）。兄弟の ids を新しい並び順で全部送る */
export async function putSceneOrder(
	projectId: string,
	ids: string[],
): Promise<void> {
	const res = await api.projects[":id"].scenes.order.$put({
		param: { id: projectId },
		json: { ids },
	});
	if (res.status !== 204) throw new Error(`put scene order: ${res.status}`);
}

export async function putShotOrder(
	sceneId: string,
	ids: string[],
): Promise<void> {
	const res = await api.scenes[":id"].shots.order.$put({
		param: { id: sceneId },
		json: { ids },
	});
	if (res.status !== 204) throw new Error(`put shot order: ${res.status}`);
}
