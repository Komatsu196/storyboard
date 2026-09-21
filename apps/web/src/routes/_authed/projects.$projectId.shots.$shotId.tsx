import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { projectQuery } from "../../api/client";
import { NotFound } from "../../components/NotFound";

export const Route = createFileRoute(
	"/_authed/projects/$projectId/shots/$shotId",
)({
	component: ShotEditorPage,
});

// Task 9 でキャンバス付きのエディタに置き換える（ここではリンク先として存在させるだけ）
function ShotEditorPage() {
	const { projectId, shotId } = Route.useParams();
	const { data: project } = useSuspenseQuery(projectQuery(projectId));
	const shot = project.scenes
		.flatMap((s) => s.shots)
		.find((s) => s.id === shotId);
	if (!shot) return <NotFound />;
	return (
		<main className="p-4">
			<Link
				to="/projects/$projectId"
				params={{ projectId }}
				className="text-sm underline"
			>
				← {project.title}
			</Link>
			<h1 className="mt-2 font-bold text-xl">C{shot.number}</h1>
			<p className="text-gray-500">（キャンバスは次のタスクで作る）</p>
		</main>
	);
}
