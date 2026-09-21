import { describe, expect, it } from "vitest";
import {
	createProjectSchema,
	createSceneSchema,
	toAspectRatio,
} from "./schemas";

describe("createProjectSchema", () => {
	it("trims the title and defaults the aspect ratio", () => {
		expect(createProjectSchema.parse({ title: "  MV  " })).toEqual({
			title: "MV",
			aspectRatio: "16:9",
		});
	});

	it("rejects a blank title", () => {
		expect(createProjectSchema.safeParse({ title: "   " }).success).toBe(false);
	});

	it("rejects an unknown aspect ratio", () => {
		expect(
			createProjectSchema.safeParse({ title: "x", aspectRatio: "1:1" }).success,
		).toBe(false);
	});
});

describe("createSceneSchema", () => {
	it("defaults the title to an empty string", () => {
		expect(createSceneSchema.parse({})).toEqual({ title: "" });
	});
});

describe("toAspectRatio", () => {
	it("keeps known values and falls back to 16:9", () => {
		expect(toAspectRatio("9:16")).toBe("9:16");
		expect(toAspectRatio("weird")).toBe("16:9");
	});
});
