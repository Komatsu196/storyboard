import type { Delta } from "../../shared/order";

const button =
	"min-h-11 min-w-11 rounded border px-3 text-sm disabled:opacity-40";

/** 編集モードでシーン見出し・カードに出す「前へ / 後へ / 削除」（T-017）。端のボタンは押せない */
export function ItemActions({
	isFirst,
	isLast,
	onMove,
	onDelete,
	disabled = false,
}: {
	isFirst: boolean;
	isLast: boolean;
	onMove: (delta: Delta) => void;
	onDelete: () => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex gap-2">
			<button
				type="button"
				onClick={() => onMove(-1)}
				disabled={isFirst}
				className={button}
			>
				前へ
			</button>
			<button
				type="button"
				onClick={() => onMove(1)}
				disabled={isLast}
				className={button}
			>
				後へ
			</button>
			<button
				type="button"
				onClick={onDelete}
				disabled={disabled}
				className={`${button} ml-auto text-red-600`}
			>
				削除
			</button>
		</div>
	);
}
