import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
	moveScene,
	moveShot,
	removeProjectFromList,
	removeScene,
	removeShot,
	setProjectFields,
	setProjectListFields,
	setSceneFields,
} from "./cache";
import {
	type Project,
	type ProjectDetail,
	projectQuery,
	projectsQuery,
	type Shot,
} from "./client";

const shot = (id: string) => ({ id, number: id }) as unknown as Shot;

function setup() {
	const qc = new QueryClient();
	qc.setQueryData(projectQuery("p").queryKey, {
		id: "p",
		title: "P",
		aspectRatio: "16:9",
		scenes: [
			{
				id: "s1",
				number: "1",
				title: "",
				shots: [shot("a"), shot("b"), shot("c")],
			},
			{ id: "s2", number: "2", title: "", shots: [] },
		],
	} as unknown as ProjectDetail);
	qc.setQueryData(projectsQuery.queryKey, [
		{ id: "p", title: "P", aspectRatio: "16:9" },
		{ id: "q", title: "Q", aspectRatio: "16:9" },
	] as unknown as Project[]);
	const detail = () =>
		qc.getQueryData(projectQuery("p").queryKey) as ProjectDetail;
	const list = () => qc.getQueryData(projectsQuery.queryKey) as Project[];
	return { qc, detail, list };
}

describe("moveScene / moveShot", () => {
	it("moves a scene and returns the new sibling ids", () => {
		const { qc, detail } = setup();
		expect(moveScene(qc, "p", "s2", -1)).toEqual(["s2", "s1"]);
		expect(detail().scenes.map((s) => s.id)).toEqual(["s2", "s1"]);
	});

	it("moves a shot within its scene and returns the new sibling ids", () => {
		const { qc, detail } = setup();
		expect(moveShot(qc, "p", "s1", "c", -1)).toEqual(["a", "c", "b"]);
		expect(detail().scenes[0].shots.map((s) => s.id)).toEqual(["a", "c", "b"]);
	});

	it("returns null and leaves the cache as is at the ends or without a cache", () => {
		const { qc, detail } = setup();
		const before = detail();
		expect(moveScene(qc, "p", "s1", -1)).toBeNull();
		expect(moveShot(qc, "p", "s1", "c", 1)).toBeNull();
		expect(moveShot(qc, "p", "s2", "a", 1)).toBeNull();
		expect(detail()).toBe(before);
		expect(moveScene(qc, "unknown", "s1", 1)).toBeNull();
	});
});

describe("remove / set fields", () => {
	it("removes a scene and a shot", () => {
		const { qc, detail } = setup();
		removeShot(qc, "p", "b");
		expect(detail().scenes[0].shots.map((s) => s.id)).toEqual(["a", "c"]);
		removeScene(qc, "p", "s1");
		expect(detail().scenes.map((s) => s.id)).toEqual(["s2"]);
	});

	it("merges scene and project fields", () => {
		const { qc, detail } = setup();
		setSceneFields(qc, "p", "s2", { number: "2A", title: "夜" });
		expect(detail().scenes[1]).toMatchObject({ number: "2A", title: "夜" });
		setProjectFields(qc, "p", { title: "New", aspectRatio: "9:16" });
		expect(detail()).toMatchObject({ title: "New", aspectRatio: "9:16" });
	});

	it("updates and removes a project in the list", () => {
		const { qc, list } = setup();
		setProjectListFields(qc, "p", { title: "New" });
		expect(list().map((p) => p.title)).toEqual(["New", "Q"]);
		removeProjectFromList(qc, "p");
		expect(list().map((p) => p.id)).toEqual(["q"]);
	});
});
