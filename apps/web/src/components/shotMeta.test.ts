import { describe, expect, it } from "vitest";
import { formatDuration, shotDeleteMessage, shotMeta } from "./shotMeta";

describe("formatDuration", () => {
	it("appends 秒 and keeps decimals as typed", () => {
		expect(formatDuration(3)).toBe("3秒");
		expect(formatDuration(2.5)).toBe("2.5秒");
		expect(formatDuration(0)).toBe("0秒");
	});
});

describe("shotMeta", () => {
	it("lists number, shot size, camera move and duration", () => {
		expect(
			shotMeta({
				number: "1",
				shotSize: "MS",
				cameraMove: "Pan",
				durationSec: 3,
			}),
		).toEqual(["C1", "MS", "Pan", "3秒"]);
	});

	it("skips empty items but always keeps the number", () => {
		expect(
			shotMeta({
				number: "2A",
				shotSize: null,
				cameraMove: "  ",
				durationSec: null,
			}),
		).toEqual(["C2A"]);
	});

	it("trims the camera move and shows a zero duration", () => {
		expect(
			shotMeta({
				number: "3",
				shotSize: null,
				cameraMove: " Dolly in ",
				durationSec: 0,
			}),
		).toEqual(["C3", "Dolly in", "0秒"]);
	});
});

describe("shotDeleteMessage", () => {
	it("names the shot by its number", () => {
		expect(shotDeleteMessage("3")).toBe("C3 を削除しますか？");
		expect(shotDeleteMessage("2A")).toBe("C2A を削除しますか？");
	});

	it("falls back to このカット when the number is empty", () => {
		expect(shotDeleteMessage("")).toBe("このカットを削除しますか？");
		expect(shotDeleteMessage("  ")).toBe("このカットを削除しますか？");
	});
});
