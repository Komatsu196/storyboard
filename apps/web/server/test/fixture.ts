import type { createApp } from "../app";
import { authed, json } from "./authed";

type App = ReturnType<typeof createApp>;

export type DetailSketch = {
	w: number;
	h: number;
	strokes: { p: number[] }[];
} | null;

/** GET /api/projects/:id の応答のうち、テストで見る部分 */
export type Detail = {
	id: string;
	title: string;
	aspectRatio: string;
	createdAt: string;
	updatedAt: string;
	scenes: {
		id: string;
		number: string;
		title: string;
		position: number;
		shots: {
			id: string;
			number: string;
			position: number;
			sketch: DetailSketch;
		}[];
	}[];
};

/** 作品 1・シーン 2（S1 にカット C1・C2、S2 は空）を作り、リクエスト関数と ID を返す */
export async function createFixture(app: App, aspectRatio = "16:9") {
	const req = await authed(app);
	const post = async (path: string, body: unknown = {}) =>
		(await (await req(path, json("POST", body))).json()) as { id: string };
	const project = await post("/api/projects", { title: "P", aspectRatio });
	const s1 = await post(`/api/projects/${project.id}/scenes`);
	const s2 = await post(`/api/projects/${project.id}/scenes`);
	const c1 = await post(`/api/scenes/${s1.id}/shots`);
	const c2 = await post(`/api/scenes/${s1.id}/shots`);
	const detail = async () =>
		(await (await req(`/api/projects/${project.id}`)).json()) as Detail;
	const putSketch = (shotId: string, p: number[], size = { w: 1600, h: 900 }) =>
		req(
			`/api/shots/${shotId}/sketch`,
			json("PUT", {
				v: 1,
				...size,
				strokes: [{ color: "black", size: 2, p }],
			}),
		);
	return { req, project, s1, s2, c1, c2, detail, putSketch };
}
