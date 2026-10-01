import { useState } from "react";
import { isImeComposing } from "./ime";
import { fieldClass } from "./ui/field";

/**
 * 編集モードの 1 行入力（T-018 / T-019）。フォーカスの間だけ下書きを持ち、フォーカスが外れたとき / Enter で確定する。
 * trim した値が元と同じ・required で空 のときは onCommit を呼ばずに元の値の表示に戻る。保存ボタンは置かない（T-011 と同じ考え方）。
 */
export function InlineField({
	label,
	value,
	onCommit,
	required = false,
	maxLength,
	placeholder,
	className = "",
}: {
	label: string;
	value: string;
	onCommit: (next: string) => void;
	required?: boolean;
	maxLength?: number;
	placeholder?: string;
	className?: string;
}) {
	// null = 編集していない（キャッシュの値をそのまま出す）
	const [draft, setDraft] = useState<string | null>(null);

	const commit = () => {
		if (draft === null) return;
		const next = draft.trim();
		setDraft(null);
		if (next === value) return;
		if (required && next === "") return;
		onCommit(next);
	};

	return (
		<input
			aria-label={label}
			value={draft ?? value}
			placeholder={placeholder}
			maxLength={maxLength}
			onFocus={() => setDraft(value)}
			onChange={(e) => setDraft(e.target.value)}
			onBlur={commit}
			onKeyDown={(e) => {
				// 変換確定の Enter で確定しない（変換中に blur すると打っている文字が消える。issue #9）
				if (e.key === "Enter" && !isImeComposing(e.nativeEvent))
					e.currentTarget.blur();
			}}
			className={`${fieldClass()} ${className}`}
		/>
	);
}
