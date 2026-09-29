/** 尺の表示。3 → "3秒"、2.5 → "2.5秒"（設計書 §5.4） */
export function formatDuration(sec: number): string {
	return `${sec}秒`;
}

/**
 * カードのメタ 1 行の要素。先頭はカット番号、以降は空でない項目だけ（T-015）。
 * shotSize は DB の text 列由来（Shot 行）なので string で受ける
 */
export function shotMeta(shot: {
	number: string;
	shotSize: string | null;
	cameraMove: string;
	durationSec: number | null;
}): string[] {
	const parts = [`C${shot.number}`];
	if (shot.shotSize) parts.push(shot.shotSize);
	const move = shot.cameraMove.trim();
	if (move !== "") parts.push(move);
	if (shot.durationSec !== null) parts.push(formatDuration(shot.durationSec));
	return parts;
}

/** カット削除の確認文（T-017 / T-023）。番号が空のカット（エディタで消した直後）は「このカット」と呼ぶ */
export function shotDeleteMessage(number: string): string {
	const n = number.trim();
	return n === "" ? "このカットを削除しますか？" : `C${n} を削除しますか？`;
}
