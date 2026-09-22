import { useEffect, useState } from "react";
import {
	type Autosaver,
	createAutosaver,
	type SaveFn,
	type SaveStatus,
} from "./autosaver";

/**
 * key（カット ID）ごとにインスタンスを 1 つだけ共有する（タブを閉じるまで）。
 * 同じカットへ素早く再入すると、古いコンポーネントの unmount flush と新しいコンポーネントの
 * 最初の set が一瞬同時にマウントされうる。別々の Autosaver だと 2 本の PUT に順序保証がなく、
 * 古い方が後から届けば新しい変更が上書きされてしまう。1 つを共有すれば PUT はキーごとに直列化され、
 * 常に最新の値が最後に届く（final-fix-brief 1）。
 */
const savers = new Map<
	string,
	{ saver: Autosaver<unknown>; saveRef: { current: SaveFn<unknown> } }
>();

function getOrCreateEntry<T>(
	key: string,
	initial: T,
	save: SaveFn<T>,
	delay: number,
) {
	const existing = savers.get(key);
	if (existing) return existing;
	// entry は key ごとに 1 つの T に対してしか使わないので、unknown へのキャストは安全
	const saveRef = { current: save as unknown as SaveFn<unknown> };
	const saver = createAutosaver<unknown>({
		initial,
		save: (v, opts) => saveRef.current(v, opts),
		delay,
	});
	const entry = { saver, saveRef };
	savers.set(key, entry);
	return entry;
}

/**
 * value が変わるたびに delay 後に save する(設計書 §5.3)。
 * 画面遷移(アンマウント)では即時 flush、タブが隠れる・ページを離れるときは keepalive 付きで flush する。
 */
export function useAutosave<T>(
	key: string,
	value: T,
	save: SaveFn<T>,
	{ delay }: { delay: number },
): { status: SaveStatus; flush: (keepalive?: boolean) => Promise<void> } {
	const [entry] = useState(() => getOrCreateEntry(key, value, save, delay));
	// この hook インスタンスが生きている間、実際に呼ばれる save を最新に保つ
	useEffect(() => {
		entry.saveRef.current = save as unknown as SaveFn<unknown>;
	}, [entry, save]);
	const saver = entry.saver as Autosaver<T>;

	const [status, setStatus] = useState<SaveStatus>(saver.status);
	useEffect(() => saver.subscribe(setStatus), [saver]);

	useEffect(() => {
		saver.set(value);
	}, [saver, value]);

	useEffect(() => {
		const onVisibility = () => {
			if (document.visibilityState === "hidden") void saver.flush(true);
		};
		const onPageHide = () => {
			void saver.flush(true);
		};
		document.addEventListener("visibilitychange", onVisibility);
		window.addEventListener("pagehide", onPageHide);
		return () => {
			document.removeEventListener("visibilitychange", onVisibility);
			window.removeEventListener("pagehide", onPageHide);
			void saver.flush(false); // SPA 内の画面遷移。再試行は裏で続く
		};
	}, [saver]);

	return { status, flush: saver.flush };
}
