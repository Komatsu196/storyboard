import { ChevronDown, ChevronUp, Copy, Trash2, X } from "lucide-react";
import type { Delta } from "../../shared/order";
import { Button } from "./ui/Button";

/**
 * 編集モードの「前へ / 後へ / 削除」（T-017 / T-021）。端のボタンは押せない。
 * variant="text" はカードの下の 1 行（「前へ / 後へ」の文字と、右端に複製・削除（ゴミ箱）のアイコン。T-034）、
 * variant="icon" はシーン見出し行の右端に置く上・下・複製・✕ のアイコン（T-027 / T-033。読み上げ名は「シーンを前へ / 後へ / 複製 / 削除」）
 */
export function ItemActions({
	isFirst,
	isLast,
	onMove,
	onDelete,
	onDuplicate,
	disabled = false,
	variant = "text",
}: {
	isFirst: boolean;
	isLast: boolean;
	onMove: (delta: Delta) => void;
	onDelete: () => void;
	onDuplicate: () => void;
	disabled?: boolean;
	variant?: "text" | "icon";
}) {
	if (variant === "icon") {
		return (
			<div className="flex shrink-0">
				<Button
					variant="ghost"
					icon={ChevronUp}
					aria-label="シーンを前へ"
					onClick={() => onMove(-1)}
					disabled={isFirst}
				/>
				<Button
					variant="ghost"
					icon={ChevronDown}
					aria-label="シーンを後へ"
					onClick={() => onMove(1)}
					disabled={isLast}
				/>
				<Button
					variant="ghost"
					icon={Copy}
					aria-label="シーンを複製"
					onClick={onDuplicate}
					disabled={disabled}
				/>
				<Button
					variant="ghost"
					icon={X}
					aria-label="シーンを削除"
					onClick={onDelete}
					disabled={disabled}
					className="text-danger"
				/>
			</div>
		);
	}
	return (
		<div className="flex gap-2">
			<Button onClick={() => onMove(-1)} disabled={isFirst}>
				前へ
			</Button>
			<Button onClick={() => onMove(1)} disabled={isLast}>
				後へ
			</Button>
			<Button
				variant="ghost"
				icon={Copy}
				aria-label="カットを複製"
				onClick={onDuplicate}
				disabled={disabled}
				className="ml-auto"
			/>
			<Button
				variant="ghost"
				icon={Trash2}
				aria-label="カットを削除"
				onClick={onDelete}
				disabled={disabled}
				className="text-danger"
			/>
		</div>
	);
}
