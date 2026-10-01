import { describe, expect, it } from "vitest";
import { isImeComposing } from "./ime";

describe("isImeComposing", () => {
	it("is true while composing (Chrome / Firefox report isComposing)", () => {
		expect(isImeComposing({ isComposing: true, keyCode: 229 })).toBe(true);
	});

	it("is true for Safari's confirm Enter (isComposing is already false, keyCode is 229)", () => {
		expect(isImeComposing({ isComposing: false, keyCode: 229 })).toBe(true);
	});

	it("is false for a plain Enter", () => {
		expect(isImeComposing({ isComposing: false, keyCode: 13 })).toBe(false);
	});
});
