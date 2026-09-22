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
	/** ステータスの変化を購読する。返り値の関数を呼ぶと購読解除する */
	subscribe: (listener: (status: SaveStatus) => void) => () => void;
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
	/** 「保存済みか」の判定。省略時は参照の一致（===）。値で比べたいときに渡す */
	equals?: (a: T, b: T) => boolean;
}): Autosaver<T> {
	const {
		save,
		delay,
		onStatus,
		retryDelays = DEFAULT_RETRY_DELAYS,
		equals = (a: T, b: T) => a === b,
	} = options;
	let latest = options.initial;
	let lastSaved = options.initial;
	let timer: ReturnType<typeof setTimeout> | null = null;
	let inFlight: Promise<void> | null = null;
	let failures = 0;
	let gaveUp = false;
	let status: SaveStatus = "saved";
	const listeners = new Set<(status: SaveStatus) => void>();
	const isSaved = () => equals(latest, lastSaved);

	function notify() {
		const next: SaveStatus = inFlight
			? "saving"
			: isSaved()
				? "saved"
				: "unsaved";
		if (next !== status) {
			status = next;
			onStatus?.(next);
			for (const listener of listeners) listener(next);
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
		if (isSaved()) {
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
				if (!gaveUp && timer === null && !isSaved()) schedule(delay);
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
			if (isSaved()) clearTimer();
			else schedule(delay);
			notify();
		},
		async flush(keepalive = false) {
			clearTimer();
			if (inFlight) await inFlight;
			clearTimer();
			await run(keepalive);
		},
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		get status() {
			return status;
		},
	};
}

/** 複数の自動保存の状態を 1 つに: どれか saving → saving、どれか unsaved → unsaved、すべて saved → saved */
export function combineStatus(...statuses: SaveStatus[]): SaveStatus {
	if (statuses.includes("saving")) return "saving";
	if (statuses.includes("unsaved")) return "unsaved";
	return "saved";
}
