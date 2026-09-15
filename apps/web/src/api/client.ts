import { queryOptions } from "@tanstack/react-query";
import { hc } from "hono/client";
import type { AppType } from "../../server/app";

export const api = hc<AppType>("/").api;

export const sessionQuery = queryOptions({
	queryKey: ["session"],
	queryFn: async () => {
		const res = await api.session.$get();
		if (res.status === 401) return { loggedIn: false as const };
		if (!res.ok) throw new Error(`session check failed: ${res.status}`);
		return { loggedIn: true as const };
	},
	staleTime: 5 * 60 * 1000,
});

export async function login(password: string): Promise<boolean> {
	const res = await api.login.$post({ json: { password } });
	return res.status === 204;
}

export async function logout(): Promise<void> {
	await api.logout.$post();
}
