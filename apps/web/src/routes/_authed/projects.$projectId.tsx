import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { projectQuery } from "../../api/client";

export const Route = createFileRoute("/_authed/projects/$projectId")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(projectQuery(params.projectId)),
	component: ProjectPage,
});

// Task 8 でレイアウトルート（Outlet）に置き換える
function ProjectPage() {
	const { projectId } = Route.useParams();
	const { data: project } = useSuspenseQuery(projectQuery(projectId));
	return (
		<main className="p-4">
			<Link to="/" className="text-sm underline">
				← 作品一覧
			</Link>
			<h1 className="mt-2 font-bold text-xl">{project.title}</h1>
			<p className="text-gray-500">
				{project.aspectRatio}（作品ページは次のタスクで作る）
			</p>
		</main>
	);
}
