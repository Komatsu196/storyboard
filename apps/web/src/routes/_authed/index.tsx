import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { logout, projectsQuery } from "../../api/client";
import { NewProjectButton } from "../../components/ProjectDialog";

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
			<header className="mb-4 flex items-center justify-between">
				<h1 className="font-bold text-xl">作品一覧</h1>
				<div className="flex items-center gap-3">
					<NewProjectButton />
					<button
						type="button"
						onClick={onLogout}
						className="text-sm underline"
					>
						ログアウト
					</button>
				</div>
			</header>
			{projects.length === 0 ? (
				<p className="text-gray-500">
					作品がありません。「＋作品」から作ってください。
				</p>
			) : (
				<ul className="divide-y">
					{projects.map((p) => (
						<li key={p.id}>
							<Link
								to="/projects/$projectId"
								params={{ projectId: p.id }}
								className="flex items-center justify-between py-3"
							>
								<span>{p.title}</span>
								<span className="text-gray-500 text-sm">{p.aspectRatio}</span>
							</Link>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
