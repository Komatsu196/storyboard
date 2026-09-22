import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAutosaver, type SaveStatus } from "./autosaver";

type Deferred = { resolve: () => void; reject: (e: unknown) => void };

function setup() {
	const calls: { value: string; keepalive: boolean }[] = [];
	const statuses: SaveStatus[] = [];
	const pending: Deferred[] = [];
	let mode: "resolve" | "reject" | "pending" = "resolve";
	const save = vi.fn((value: string, opts: { keepalive: boolean }) => {
		calls.push({ value, keepalive: opts.keepalive });
		if (mode === "reject") return Promise.reject(new Error("network"));
		if (mode === "pending") {
			return new Promise<void>((resolve, reject) => {
				pending.push({ resolve, reject });
			});
		}
		return Promise.resolve();
	});
	const saver = createAutosaver({
		initial: "v0",
		save,
		delay: 800,
		onStatus: (s) => statuses.push(s),
	});
	return {
		saver,
		calls,
		statuses,
		pending,
		setMode: (m: typeof mode) => {
			mode = m;
		},
	};
}

describe("createAutosaver", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("saves the latest value once after the delay", async () => {
		const { saver, calls, statuses } = setup();
		saver.set("v1");
		saver.set("v2");
		expect(saver.status).toBe("unsaved");
		await vi.advanceTimersByTimeAsync(799);
		expect(calls).toEqual([]);
		await vi.advanceTimersByTimeAsync(1);
		expect(calls).toEqual([{ value: "v2", keepalive: false }]);
		expect(saver.status).toBe("saved");
		expect(statuses).toEqual(["unsaved", "saving", "saved"]);
	});

	it("does nothing when the value returns to the last saved one", async () => {
		const { saver, calls } = setup();
		saver.set("v1");
		saver.set("v0");
		expect(saver.status).toBe("saved");
		await vi.advanceTimersByTimeAsync(2000);
		expect(calls).toEqual([]);
	});

	it("saves again when the value changes during a save", async () => {
		const { saver, calls, pending, setMode } = setup();
		setMode("pending");
		saver.set("v1");
		await vi.advanceTimersByTimeAsync(800);
		expect(calls.map((c) => c.value)).toEqual(["v1"]);
		saver.set("v2");
		expect(saver.status).toBe("saving");
		setMode("resolve");
		pending[0].resolve();
		await vi.advanceTimersByTimeAsync(0);
		expect(saver.status).toBe("unsaved");
		await vi.advanceTimersByTimeAsync(800);
		expect(calls.map((c) => c.value)).toEqual(["v1", "v2"]);
		expect(saver.status).toBe("saved");
	});

	it("retries with backoff, then waits for the next change", async () => {
		const { saver, calls, setMode } = setup();
		setMode("reject");
		saver.set("v1");
		await vi.advanceTimersByTimeAsync(800);
		expect(calls).toHaveLength(1);
		await vi.advanceTimersByTimeAsync(1000);
		expect(calls).toHaveLength(2);
		await vi.advanceTimersByTimeAsync(2000);
		expect(calls).toHaveLength(3);
		await vi.advanceTimersByTimeAsync(4000);
		expect(calls).toHaveLength(4);
		await vi.advanceTimersByTimeAsync(60_000);
		expect(calls).toHaveLength(4); // あきらめて待つ
		expect(saver.status).toBe("unsaved");

		setMode("resolve");
		saver.set("v2");
		await vi.advanceTimersByTimeAsync(800);
		expect(calls).toHaveLength(5);
		expect(calls[4]).toEqual({ value: "v2", keepalive: false });
		expect(saver.status).toBe("saved");
	});

	it("flush saves immediately with keepalive and cancels the timer", async () => {
		const { saver, calls } = setup();
		saver.set("v1");
		await saver.flush(true);
		expect(calls).toEqual([{ value: "v1", keepalive: true }]);
		expect(saver.status).toBe("saved");
		await vi.advanceTimersByTimeAsync(2000);
		expect(calls).toHaveLength(1);
	});

	it("flush does nothing when there is nothing to save", async () => {
		const { saver, calls } = setup();
		await saver.flush();
		expect(calls).toEqual([]);
	});

	it("flush waits for the in-flight save and then sends the newer value", async () => {
		const { saver, calls, pending, setMode } = setup();
		setMode("pending");
		saver.set("v1");
		await vi.advanceTimersByTimeAsync(800);
		saver.set("v2");
		setMode("resolve");
		const flushed = saver.flush();
		pending[0].resolve();
		await flushed;
		expect(calls.map((c) => c.value)).toEqual(["v1", "v2"]);
		expect(saver.status).toBe("saved");
	});
});
