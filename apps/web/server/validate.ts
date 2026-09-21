import type { Context } from "hono";

// zValidator が渡す result のうち、ここで使う部分だけ（zod v3/v4 どちらの ZodError も issues を持つ）
type Result =
	| { success: true }
	| { success: false; error: { issues: unknown[] } };

/** zValidator の第 3 引数。失敗したら 400 {"error":"validation","issues":[…]} を返す（設計書 §4） */
export function validationHook(result: Result, c: Context) {
	if (!result.success) {
		return c.json(
			{ error: "validation" as const, issues: result.error.issues },
			400,
		);
	}
}
