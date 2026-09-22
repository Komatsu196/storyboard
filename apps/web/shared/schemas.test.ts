import { describe, expect, it } from "vitest";
import {
	cameraMoves,
	createProjectSchema,
	createSceneSchema,
	pickShotFields,
	shotFieldsEqual,
	shotSizes,
	toAspectRatio,
	toShotSize,
	updateShotSchema,
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

describe("fixed lists", () => {
	it("match D-007", () => {
		expect(shotSizes).toEqual(["LS", "FS", "MS", "BS", "CU", "ECU"]);
		expect(cameraMoves).toEqual([
			"Fix",
			"Pan",
			"Tilt",
			"Dolly",
			"Handheld",
			"Gimbal",
		]);
	});
});

describe("updateShotSchema", () => {
	it("accepts a partial update and trims the number and camera move", () => {
		expect(
			updateShotSchema.parse({
				number: " 2A ",
				cameraMove: " Pan ",
				durationSec: 2.5,
			}),
		).toEqual({ number: "2A", cameraMove: "Pan", durationSec: 2.5 });
	});

	it("accepts null for shot size and duration", () => {
		expect(
			updateShotSchema.parse({ shotSize: null, durationSec: null }),
		).toEqual({
			shotSize: null,
			durationSec: null,
		});
	});

	it("keeps multi-line text as is", () => {
		expect(updateShotSchema.parse({ action: "  a\nb  " })).toEqual({
			action: "  a\nb  ",
		});
	});

	it("accepts an empty object", () => {
		expect(updateShotSchema.parse({})).toEqual({});
	});

	it("rejects a blank number", () => {
		expect(updateShotSchema.safeParse({ number: "   " }).success).toBe(false);
	});

	it("rejects an unknown shot size", () => {
		expect(updateShotSchema.safeParse({ shotSize: "XL" }).success).toBe(false);
	});

	it("rejects a negative duration", () => {
		expect(updateShotSchema.safeParse({ durationSec: -1 }).success).toBe(false);
	});

	it("rejects text over the limits", () => {
		expect(updateShotSchema.safeParse({ number: "x".repeat(21) }).success).toBe(
			false,
		);
		expect(
			updateShotSchema.safeParse({ notes: "x".repeat(2001) }).success,
		).toBe(false);
	});
});

describe("toShotSize", () => {
	it("keeps known values and maps unknown or null to null", () => {
		expect(toShotSize("CU")).toBe("CU");
		expect(toShotSize("XL")).toBeNull();
		expect(toShotSize(null)).toBeNull();
	});
});

describe("pickShotFields / shotFieldsEqual", () => {
	const row = {
		id: "s1",
		sceneId: "sc1",
		position: 0,
		number: "1",
		shotSize: "MS",
		cameraMove: "Pan",
		action: "A が振り返る",
		dialogue: "",
		durationSec: 3,
		notes: "",
		createdAt: "2026-09-22T00:00:00.000Z",
		updatedAt: "2026-09-22T00:00:00.000Z",
	};

	it("picks the 7 fields and narrows the shot size", () => {
		expect(pickShotFields(row)).toEqual({
			number: "1",
			shotSize: "MS",
			cameraMove: "Pan",
			action: "A が振り返る",
			dialogue: "",
			durationSec: 3,
			notes: "",
		});
		expect(pickShotFields({ ...row, shotSize: "weird" }).shotSize).toBeNull();
	});

	it("compares the 7 fields by value", () => {
		const a = pickShotFields(row);
		expect(shotFieldsEqual(a, pickShotFields(row))).toBe(true);
		expect(shotFieldsEqual(a, { ...a, notes: "三脚" })).toBe(false);
		expect(shotFieldsEqual(a, { ...a, durationSec: null })).toBe(false);
	});
});
