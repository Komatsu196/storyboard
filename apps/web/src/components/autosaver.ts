export type SaveStatus = "saved" | "saving" | "unsaved";
export type SaveFn<T> = (
	value: T,
	opts: { keepalive: boolean },
) => Promise<void>;

export type Autosaver<T> = {
	/** 値が変わったら呼ぶ。delay 後に保存する（連続して呼ばれたら延期） */
	set: (value: T) => void;
	/** 予約を取り消して今すぐ保存する。送信中なら終わってから最新値を送る */
	flush: (keepalive?: boolean) => Promise<void>;
	readonly status: SaveStatus;
};

const DEFAULT_RETRY_DELAYS = [1000, 2000, 4000];

/**
 * 自動保存の純粋ロジック（T-011、設計書 §5.3）。値の比較は参照（===）で、
 * 保存に成功した値と同じ参照に戻れば「保存済み」になる。失敗は retryDelays で再試行し、
 * 尽きたら次の set まで待つ。ローカルの値は捨てない。
 */
export function createAutosaver<T>(options: {
	initial: T;
	save: SaveFn<T>;
	delay: number;
	onStatus?: (status: SaveStatus) => void;
	retryDelays?: number[];
}): Autosaver<T> {
	const { save, delay, onStatus, retryDelays = DEFAULT_RETRY_DELAYS } = options;
	let latest = options.initial;
	let lastSaved = options.initial;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<void> | null = null;
	let failures = 0;
	let gaveUp = false;
	let status: SaveStatus = "saved";

	function notify() {
		const next: SaveStatus = inFlight
			? "saving"
			: latest === lastSaved
				? "saved"
				: "unsaved";
		if (next !== status) {
			status = next;
			onStatus?.(next);
		}
	}

	function clearTimer() {
		if (timer !== null) {
			clearTimeout(timer);
			timer = null;
		}
	}

	function schedule(ms: number) {
		clearTimer();
		timer = setTimeout(() => {
			timer = null;
			void run(false);
		}, ms);
	}

	function run(keepalive: boolean): Promise<void> {
		if (inFlight) return inFlight;
		if (latest === lastSaved) {
			notify();
			return Promise.resolve();
		}
		const value = latest;
		inFlight = save(value, { keepalive })
			.then(
				() => {
					lastSaved = value;
					failures = 0;
				},
				() => {
					failures += 1;
					if (failures <= retryDelays.length) {
						schedule(retryDelays[failures - 1]);
					} else {
						failures = 0;
						gaveUp = true;
					}
				},
			)
			.finally(() => {
				inFlight = null;
				// 送信中に値が変わっていたら、もう一度予約する
				if (!gaveUp && timer === null && latest !== lastSaved) schedule(delay);
				notify();
			});
		notify();
		return inFlight;
	}

	return {
		set(value) {
			latest = value;
			gaveUp = false;
			failures = 0;
			if (latest === lastSaved) clearTimer();
			else schedule(delay);
			notify();
		},
		async flush(keepalive = false) {
			clearTimer();
			if (inFlight) await inFlight;
			clearTimer();
			await run(keepalive);
		},
		get status() {
			return status;
		},
	};
}
