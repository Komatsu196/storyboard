import { useEffect, useRef, useState } from "react";
import {
	type Autosaver,
	createAutosaver,
	type SaveFn,
	type SaveStatus,
} from "./autosaver";

/**
 * value が変わるたびに delay 後に save する（設計書 §5.3）。
 * 画面遷移（アンマウント）では即時 flush、タブが隠れる・ページを離れるときは keepalive 付きで flush する。
 */
export function useAutosave<T>(
	value: T,
	save: SaveFn<T>,
	{ delay }: { delay: number },
): { status: SaveStatus; flush: (keepalive?: boolean) => Promise<void> } {
	const [status, setStatus] = useState<SaveStatus>("saved");
	const saveRef = useRef(save);
	useEffect(() => {
		saveRef.current = save;
	}, [save]);
	const [saver] = useState<Autosaver<T>>(() =>
		createAutosaver({
			initial: value,
			save: (v, opts) => saveRef.current(v, opts),
			delay,
			onStatus: setStatus,
		}),
	);

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
