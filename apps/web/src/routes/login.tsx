import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { login, sessionQuery } from "../api/client";
import { Button } from "../components/ui/Button";
import { fieldClass } from "../components/ui/field";

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
			queryClient.removeQueries({ queryKey: sessionQuery.queryKey });
			await navigate({ href: redirect ?? "/" });
		},
	});

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setFailed(false);
		mutation.mutate(password);
	};

	return (
		<main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center p-6">
			<div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
				<h1 className="font-bold text-xl">Storyboard</h1>
				<form onSubmit={onSubmit} className="flex flex-col gap-3">
					<input
						type="password"
						autoComplete="current-password"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="パスワード"
						className={`${fieldClass()} w-full`}
					/>
					<Button
						type="submit"
						variant="primary"
						disabled={mutation.isPending || password === ""}
					>
						ログイン
					</Button>
					{failed && (
						<p className="text-danger text-sm">パスワードが違います</p>
					)}
				</form>
			</div>
		</main>
	);
}
