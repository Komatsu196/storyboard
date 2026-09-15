import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { login, sessionQuery } from "../api/client";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
	validateSearch: (search: Record<string, unknown>): LoginSearch => ({
		// 同一オリジンのパスだけ許可する（外部 URL への転送を防ぐ）
		redirect:
			typeof search.redirect === "string" && search.redirect.startsWith("/")
				? search.redirect
				: undefined,
	}),
	component: LoginPage,
});

function LoginPage() {
	const { redirect } = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [password, setPassword] = useState("");
	const [failed, setFailed] = useState(false);

	const mutation = useMutation({
		mutationFn: login,
		onSuccess: async (ok) => {
			if (!ok) {
				setFailed(true);
				return;
			}
			await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
			await navigate({ href: redirect ?? "/" });
		},
	});

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setFailed(false);
		mutation.mutate(password);
	};

	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 p-6">
			<h1 className="font-bold text-xl">Storyboard</h1>
			<form onSubmit={onSubmit} className="flex flex-col gap-3">
				<input
					type="password"
					autoComplete="current-password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="パスワード"
					className="rounded border px-3 py-2"
				/>
				<button
					type="submit"
					disabled={mutation.isPending || password === ""}
					className="rounded bg-black px-3 py-2 text-white disabled:opacity-40"
				>
					ログイン
				</button>
				{failed && <p className="text-red-600 text-sm">パスワードが違います</p>}
			</form>
		</main>
	);
}
