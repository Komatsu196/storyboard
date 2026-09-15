import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { logout, sessionQuery } from "../../api/client";

export const Route = createFileRoute("/_authed/")({
	component: Home,
});

function Home() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const onLogout = async () => {
		await logout();
		queryClient.removeQueries({ queryKey: sessionQuery.queryKey });
		await navigate({ to: "/login" });
	};
	return (
		<main className="p-4">
			<header className="flex items-center justify-between">
				<h1 className="font-bold text-xl">作品一覧</h1>
				<button type="button" onClick={onLogout} className="text-sm underline">
					ログアウト
				</button>
			</header>
			<p className="mt-4 text-gray-500">（作品一覧は次の段階で作る）</p>
		</main>
	);
}
