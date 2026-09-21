import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toAspectRatio } from "../../../shared/schemas";
import { emptySketch } from "../../../shared/sketch/types";
import { type ProjectDetail, projectQuery, type Shot } from "../../api/client";
import { NotFound } from "../../components/NotFound";
import { SketchCanvas } from "../../sketch/SketchCanvas";
import { Toolbar } from "../../sketch/Toolbar";
import { useSketchEditor } from "../../sketch/useSketchEditor";

export const Route = createFileRoute(
	"/_authed/projects/$projectId/shots/$shotId",
)({
	component: ShotEditorPage,
});

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
	// 初期データはキャッシュから（追加リクエストなし。設計書 §6.4）。開いた後のキャッシュ更新では作り直さない
	const [initial] = useState(
		() => shot.sketch ?? emptySketch(toAspectRatio(project.aspectRatio)),
	);
	const editor = useSketchEditor(initial);

	return (
		<div className="flex min-h-dvh flex-col md:flex-row">
			{/* ステージ: ヘッダ＋キャンバス＋ツールバーで画面ちょうど 1 枚分。③ で右（スマホは下）にフォームを足す */}
			<div className="flex h-dvh flex-col md:flex-1">
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
					<Link
						to="/projects/$projectId"
						params={{ projectId: project.id }}
						className="truncate text-sm underline"
					>
						← {project.title}
					</Link>
					<span className="shrink-0 font-bold">C{shot.number}</span>
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
