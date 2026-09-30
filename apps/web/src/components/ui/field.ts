/**
 * 入力欄（input / select / textarea）の共通クラス（T-026、設計書 §5.7）。
 * 白地・枠・角丸、フォーカスで藍の輪。invalid のときは枠と輪を danger にする。
 * 幅は含めないので、呼ぶ側で w-full / w-28 / flex-1 などを足す
 */
export function fieldClass(invalid = false): string {
	return `min-h-11 rounded-md border bg-surface px-3 py-2 text-ink placeholder:text-ink-muted focus:outline-hidden focus:ring-2 ${
		invalid
			? "border-danger focus:ring-danger/30"
			: "border-line-strong focus:border-accent focus:ring-accent/30"
	}`;
}
