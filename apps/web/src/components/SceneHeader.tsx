import type { Scene } from "../api/client";

export function SceneHeader({
	scene,
	onAddShot,
	disabled,
}: {
	scene: Scene;
	onAddShot: () => void;
	disabled?: boolean;
}) {
	return (
		<div className="mb-2 flex items-center gap-3">
			<h2 className="font-bold">
				S{scene.number}
				{scene.title && (
					<span className="ml-2 font-normal text-gray-600">{scene.title}</span>
				)}
			</h2>
			<button
				type="button"
				onClick={onAddShot}
				disabled={disabled}
				className="rounded border px-2 py-1 text-sm disabled:opacity-40"
			>
				＋カット
			</button>
		</div>
	);
}
