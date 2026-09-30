import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { logout, projectsQuery } from "../../api/client";
import { NewProjectButton } from "../../components/ProjectDialog";
import { Button } from "../../components/ui/Button";

export const Route = createFileRoute("/_authed/")({
	loader: ({ context }) => context.queryClient.ensureQueryData(projectsQuery),
	component: Home,
});

function Home() {
	const { data: projects } = useSuspenseQuery(projectsQuery);
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const onLogout = async () => {
		await logout();
		queryClient.clear();
		await navigate({ to: "/login" });
	};
	return (
		<main className="mx-auto max-w-3xl p-4">
			<header className="mb-4 flex items-center justify-between gap-3">
				<h1 className="font-bold text-xl">作品一覧</h1>
				<div className="flex items-center gap-2">
					<NewProjectButton />
					<Button variant="ghost" onClick={onLogout}>
						ログアウト
					</Button>
				</div>
			</header>
			{projects.length === 0 ? (
				<p className="text-ink-muted">
					作品がありません。「＋作品」から作ってください。
				</p>
			) : (
				<ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
					{projects.map((p) => (
						<li key={p.id}>
							<Link
								to="/projects/$projectId"
								params={{ projectId: p.id }}
								className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-canvas active:bg-canvas"
							>
								<span className="min-w-0 flex-1 truncate">{p.title}</span>
								<span className="shrink-0 text-ink-muted text-sm">
									{p.aspectRatio}
								</span>
								<ChevronRight
									aria-hidden
									className="size-5 shrink-0 text-ink-muted"
								/>
							</Link>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
