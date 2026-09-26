import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useState,
} from "react";
import {
	pickShotFields,
	type ShotFields,
	shotFieldsEqual,
	toAspectRatio,
} from "../../../shared/schemas";
import { emptySketch, type SketchData } from "../../../shared/sketch/types";
import { setShotFields, setShotSketch } from "../../api/cache";
import {
	type ProjectDetail,
	patchShot,
	projectQuery,
	putSketch,
	type Shot,
} from "../../api/client";
import { combineStatus, type SaveStatus } from "../../components/autosaver";
import { NotFound } from "../../components/NotFound";
import { ShotForm } from "../../components/ShotForm";
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

	const saveSketch = useCallback(
		async (data: SketchData, opts: { keepalive: boolean }) => {
			await putSketch(shot.id, data, opts);
			// 保存完了後にも書く（保存中に再取得が走って古いデータに戻された場合の保険）
			setShotSketch(queryClient, project.id, shot.id, data);
		},
		[queryClient, project.id, shot.id],
	);
	const sketchSave = useAutosave(shot.id, editor.committed, saveSketch, {
		delay: 800,
	});

	// ストロークが確定するたびにキャッシュへ書き、作品ページに戻ったときサムネイルが最新になるようにする（設計書 §5.2）
	useEffect(() => {
		setShotSketch(queryClient, project.id, shot.id, editor.committed);
	}, [queryClient, project.id, shot.id, editor.committed]);

	// 8項目フォーム（画を除く 7 項目）。初期値はキャッシュから 1 回だけ（T-016、設計書 §6.5）
	const [fields, setFields] = useState<ShotFields>(() => pickShotFields(shot));
	const numberEmpty = fields.number.trim() === "";
	const saveFields = useCallback(
		async (value: ShotFields, opts: { keepalive: boolean }) => {
			// 番号が空のあいだは送らない。番号が入った時点で 7 項目まとめて送る
			if (value.number.trim() === "") return;
			const row = await patchShot(shot.id, value, opts);
			setShotFields(queryClient, project.id, shot.id, {
				...pickShotFields(row),
				updatedAt: row.updatedAt,
			});
		},
		[queryClient, project.id, shot.id],
	);
	const fieldsSave = useAutosave(`fields:${shot.id}`, fields, saveFields, {
		delay: 1500,
		equals: shotFieldsEqual,
	});
	// 入力のたびにキャッシュへ書き、作品ページに戻ったとき即反映する。番号が空のあいだは書かない（保存されない値をカードに映さない）
	useEffect(() => {
		if (numberEmpty) return;
		setShotFields(queryClient, project.id, shot.id, fields);
	}, [queryClient, project.id, shot.id, fields, numberEmpty]);

	const status: SaveStatus = numberEmpty
		? "unsaved"
		: combineStatus(sketchSave.status, fieldsSave.status);

	return (
		<div className="flex min-h-dvh flex-col md:h-dvh md:flex-row">
			{/* ステージ: ヘッダ＋キャンバス＋ツールバー。スマホは内容の高さ（下にフォームが続く）、PC は 1 画面（T-016） */}
			<div className="flex touch-manipulation flex-col md:h-full md:min-w-0 md:flex-1">
				<header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
					<Link
						to="/projects/$projectId"
						params={{ projectId: project.id }}
						className="truncate text-sm underline"
					>
						← {project.title}
					</Link>
					<span className="shrink-0 font-bold">C{fields.number}</span>
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
				{/* スマホ: 幅 × h/w の高さ（上限は画面 − ヘッダ − ツールバー）。PC: 残りの高さいっぱい */}
				<div
					className="max-md:aspect-(--canvas-ar) max-md:max-h-[calc(100dvh-6.5rem)] bg-gray-100 p-2 md:min-h-0 md:flex-1"
					style={
						{ "--canvas-ar": `${initial.w} / ${initial.h}` } as CSSProperties
					}
				>
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
			{/* フォーム: スマホはツールバーの直下、PC は右列で独立にスクロール */}
			<aside className="border-t md:w-80 md:overflow-y-auto md:border-t-0 md:border-l lg:w-96">
				<ShotForm
					fields={fields}
					onChange={setFields}
					onBlur={() => void fieldsSave.flush()}
				/>
			</aside>
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
