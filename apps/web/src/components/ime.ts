/**
 * 日本語入力の変換中のキー（変換確定の Enter など）なら true。
 * Chrome / Firefox は isComposing が true になる。Safari は確定の Enter を compositionend の後に送るので
 * isComposing が false になるが、keyCode は 229 のままなのでそれで見分ける
 */
export function isImeComposing(e: {
	isComposing: boolean;
	keyCode: number;
}): boolean {
	return e.isComposing || e.keyCode === 229;
}
