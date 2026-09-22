import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toAspectRatio } from "../../../shared/schemas";
import { emptySketch, type SketchData } from "../../../shared/sketch/types";
import { setShotSketch } from "../../api/cache";
import {
	type ProjectDetail,
	projectQuery,
	putSketch,
	type Shot,
} from "../../api/client";
import type { SaveStatus } from "../../components/autosaver";
import { NotFound } from "../../components/NotFound";
import { useAutosave } from "../../components/useAutosave";
import { SketchCanvas } from "../../sketch/SketchCanvas";
import { Toolbar } from "../../sketch/Toolbar";
import { useSketchEditor } from "../../sketch/useSketchEditor";

export const Route = createFileRoute(
	"/_authed/projects/$projectId/shots/$shotId",
)({
	component: ShotEditorPage,
});

const statusLabels: Record<SaveStatus, string> = {
	saved: "保存済み",
	saving: "保存中…",
	unsaved: "未保存",
};

function ShotEditorPage() {
	const { projectId, shotId } = Route.useParams();
	const { data: project } = useSuspenseQuery(projectQuery(projectId));
	const shot = project.scenes
		.flatMap((s) => s.shots)
		.find((s) => s.id === shotId);
	if (!shot) return <NotFound />;
	// key でカットが変わるたびにエディタの状態を作り直す
	return <ShotEditor key={shot.id} project={project} shot={shot} />;
}

function ShotEditor({ project, shot }: { project: ProjectDetail; shot: Shot }) {
	const queryClient = useQueryClient();
	// 初期データはキャッシュから（追加リクエストなし。設計書 §6.4）。開いた後のキャッシュ更新では作り直さない
	const [initial] = useState(
		() => shot.sketch ?? emptySketch(toAspectRatio(project.aspectRatio)),
	);
	const editor = useSketchEditor(initial);

	const save = useCallback(
		async (data: SketchData, opts: { keepalive: boolean }) => {
			await putSketch(shot.id, data, opts);
			// 保存完了後にも書く（保存中に再取得が走って古いデータに戻された場合の保険）
			setShotSketch(queryClient, project.id, shot.id, data);
		},
		[queryClient, project.id, shot.id],
	);
	const { status } = useAutosave(shot.id, editor.committed, save, {
		delay: 800,
	});

	// ストロークが確定するたびにキャッシュへ書き、作品ページに戻ったときサムネイルが最新になるようにする（設計書 §5.2）
	useEffect(() => {
		setShotSketch(queryClient, project.id, shot.id, editor.committed);
	}, [queryClient, project.id, shot.id, editor.committed]);

	return (
		<div className="flex min-h-dvh flex-col md:flex-row">
			{/* ステージ: ヘッダ＋キャンバス＋ツールバーで画面ちょうど 1 枚分。③ で右（スマホは下）にフォームを足す */}
			<div className="flex h-dvh touch-manipulation flex-col md:flex-1">
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
					<Link
						to="/projects/$projectId"
						params={{ projectId: project.id }}
						className="truncate text-sm underline"
					>
						← {project.title}
					</Link>
					<span className="shrink-0 font-bold">C{shot.number}</span>
					<span
						className={`shrink-0 text-xs ${status === "unsaved" ? "text-red-600" : "text-gray-500"}`}
					>
						{statusLabels[status]}
					</span>
					<span className="flex-1" />
					<HeaderButton
						label="戻す"
						onClick={editor.undo}
						disabled={!editor.canUndo}
					>
						↶
					</HeaderButton>
					<HeaderButton
						label="やり直す"
						onClick={editor.redo}
						disabled={!editor.canRedo}
					>
						↷
					</HeaderButton>
					<HeaderButton
						label="全消し"
						onClick={editor.clear}
						disabled={editor.sketch.strokes.length === 0}
					>
						🗑
					</HeaderButton>
				</header>
				<div className="min-h-0 flex-1 bg-gray-100 p-2">
					<SketchCanvas
						sketch={editor.sketch}
						tool={editor.tool}
						onStroke={editor.addStroke}
						onErase={editor.erase}
						onEraseEnd={editor.endErase}
						onEraseCancel={editor.cancelErase}
					/>
				</div>
				<Toolbar tool={editor.tool} onChange={editor.setTool} />
			</div>
		</div>
	);
}

function HeaderButton({
	label,
	onClick,
	disabled,
	children,
}: {
	label: string;
	onClick: () => void;
	disabled?: boolean;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={onClick}
			disabled={disabled}
			className="min-h-11 min-w-11 touch-manipulation rounded text-xl disabled:opacity-30"
		>
			{children}
		</button>
	);
}
