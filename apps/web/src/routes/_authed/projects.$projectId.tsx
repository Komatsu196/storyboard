import {
	createFileRoute,
	type ErrorComponentProps,
	Outlet,
} from "@tanstack/react-router";
import { NotFoundError, projectQuery } from "../../api/client";
import { NotFound } from "../../components/NotFound";

// 作品ページとカット編集の親。作品を 1 回読んでキャッシュに置き、子は useSuspenseQuery で読む
export const Route = createFileRoute("/_authed/projects/$projectId")({
	loader: ({ context, params }) =>
		context.queryClient.ensureQueryData(projectQuery(params.projectId)),
	errorComponent: ProjectError,
	component: () => <Outlet />,
});

function ProjectError({ error }: ErrorComponentProps) {
	if (error instanceof NotFoundError) return <NotFound />;
	return (
		<main className="p-4">
			<p>読み込みに失敗しました</p>
			<button
				type="button"
				onClick={() => location.reload()}
				className="mt-2 text-accent underline"
			>
				再読み込み
			</button>
		</main>
	);
}
