import type { Delta } from "../../shared/order";

const textButton =
	"min-h-11 min-w-11 rounded border px-3 text-sm disabled:opacity-40";
const iconButton =
	"min-h-11 min-w-11 touch-manipulation rounded text-lg disabled:opacity-30";

/**
 * 編集モードの「前へ / 後へ / 削除」（T-017 / T-021）。端のボタンは押せない。
 * variant="text" はカードの下の 1 行（「前へ / 後へ / カットを削除」）、
 * variant="icon" はシーン見出し行の右端に置く ▲▼✕（読み上げ名は「シーンを前へ / 後へ / 削除」）
 */
export function ItemActions({
	isFirst,
	isLast,
	onMove,
	onDelete,
	disabled = false,
	variant = "text",
}: {
	isFirst: boolean;
	isLast: boolean;
	onMove: (delta: Delta) => void;
	onDelete: () => void;
	disabled?: boolean;
	variant?: "text" | "icon";
}) {
	if (variant === "icon") {
		return (
			<div className="flex shrink-0">
				<button
					type="button"
					aria-label="シーンを前へ"
					title="シーンを前へ"
					onClick={() => onMove(-1)}
					disabled={isFirst}
					className={iconButton}
				>
					▲
				</button>
				<button
					type="button"
					aria-label="シーンを後へ"
					title="シーンを後へ"
					onClick={() => onMove(1)}
					disabled={isLast}
					className={iconButton}
				>
					▼
				</button>
				<button
					type="button"
					aria-label="シーンを削除"
					title="シーンを削除"
					onClick={onDelete}
					disabled={disabled}
					className={`${iconButton} text-red-600`}
				>
					✕
				</button>
			</div>
		);
	}
	return (
		<div className="flex gap-2">
			<button
				type="button"
				onClick={() => onMove(-1)}
				disabled={isFirst}
				className={textButton}
			>
				前へ
			</button>
			<button
				type="button"
				onClick={() => onMove(1)}
				disabled={isLast}
				className={textButton}
			>
				後へ
			</button>
			<button
				type="button"
				onClick={onDelete}
				disabled={disabled}
				className={`${textButton} ml-auto text-red-600`}
			>
				カットを削除
			</button>
		</div>
	);
}
