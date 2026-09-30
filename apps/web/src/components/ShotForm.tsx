import {
	type ChangeEvent,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { cameraMoves, type ShotFields, shotSizes } from "../../shared/schemas";
import { Button } from "./ui/Button";
import { fieldClass } from "./ui/field";

type Props = {
	fields: ShotFields;
	onChange: (fields: ShotFields) => void;
	/** 項目からフォーカスが外れたとき（親が自動保存の flush に使う） */
	onBlur: () => void;
	/** 「このカットを削除」（T-023）。確認・送信・遷移は親が持つ */
	onDelete: () => void;
	deleting: boolean;
	deleteError: string | null;
};

const inputClass = `${fieldClass()} w-full`;

/** 複数行入力の高さを内容に合わせる。scrollHeight は padding まで、border-box なので枠線ぶんを足す */
function fitHeight(el: HTMLTextAreaElement) {
	el.style.height = "auto";
	el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

function chipClass(active: boolean) {
	// 44px 以上のタップ目標、ダブルタップでのズームを止める（ツールバーと同じ）。選択中は差し色（D-017）
	return `min-h-11 touch-manipulation rounded-md border px-3 text-sm ${
		active
			? "border-accent bg-accent text-white"
			: "border-line-strong bg-surface active:bg-canvas"
	}`;
}

/** 8項目のうち画を除く 7 項目のフォーム（T-016、設計書 §6.5）。状態は親が持つ controlled */
export function ShotForm({
	fields,
	onChange,
	onBlur,
	onDelete,
	deleting,
	deleteError,
}: Props) {
	const set = <K extends keyof ShotFields>(key: K, value: ShotFields[K]) =>
		onChange({ ...fields, [key]: value });
	const numberEmpty = fields.number.trim() === "";

	return (
		<form
			onSubmit={(e) => e.preventDefault()}
			onBlur={onBlur}
			className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
		>
			<Field label="番号">
				<div className="flex items-center gap-1">
					<span className="font-bold">C</span>
					<input
						value={fields.number}
						onChange={(e) => set("number", e.target.value)}
						maxLength={20}
						aria-label="カット番号"
						aria-invalid={numberEmpty}
						className={`${fieldClass(numberEmpty)} w-full`}
					/>
				</div>
				{numberEmpty && (
					<p className="text-danger text-xs">番号を入れるまで保存されません</p>
				)}
			</Field>

			<Field label="ショットサイズ">
				<div className="flex flex-wrap gap-2">
					{shotSizes.map((size) => {
						const active = fields.shotSize === size;
						return (
							<button
								key={size}
								type="button"
								aria-pressed={active}
								onClick={() => set("shotSize", active ? null : size)}
								className={chipClass(active)}
							>
								{size}
							</button>
						);
					})}
				</div>
			</Field>

			<Field label="カメラの動き">
				<div className="flex flex-wrap gap-2">
					{cameraMoves.map((move) => {
						const active = fields.cameraMove === move;
						return (
							<button
								key={move}
								type="button"
								aria-pressed={active}
								onClick={() => set("cameraMove", active ? "" : move)}
								className={chipClass(active)}
							>
								{move}
							</button>
						);
					})}
				</div>
				<input
					value={fields.cameraMove}
					onChange={(e) => set("cameraMove", e.target.value)}
					maxLength={100}
					aria-label="カメラの動き"
					placeholder="自由入力（Dolly in など）"
					className={inputClass}
				/>
			</Field>

			<Field label="内容">
				<GrowingTextarea
					label="内容"
					value={fields.action}
					onChange={(v) => set("action", v)}
				/>
			</Field>

			<Field label="セリフ・音">
				<GrowingTextarea
					label="セリフ・音"
					value={fields.dialogue}
					onChange={(v) => set("dialogue", v)}
				/>
			</Field>

			<Field label="尺">
				<DurationInput
					value={fields.durationSec}
					onChange={(v) => set("durationSec", v)}
				/>
			</Field>

			<Field label="備考">
				<GrowingTextarea
					label="備考"
					value={fields.notes}
					onChange={(v) => set("notes", v)}
				/>
			</Field>

			<div className="mt-4 flex flex-col gap-1">
				<Button
					variant="danger"
					onClick={onDelete}
					disabled={deleting}
					className="self-start"
				>
					このカットを削除
				</Button>
				{deleteError && (
					<p role="alert" className="text-danger text-sm">
						{deleteError}
					</p>
				)}
			</div>
		</form>
	);
}

function Field({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-1">
			<span className="text-ink-muted text-xs">{label}</span>
			{children}
		</div>
	);
}

/**
 * 内容に合わせて高さが伸びる複数行入力。CSS の field-sizing は Safari 未対応なので JS で合わせる。
 * 伸びた下端がキーボードの裏に入らないよう、高さを合わせるたびに見える位置へスクロールする（T-024）
 */
function GrowingTextarea({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const ref = useRef<HTMLTextAreaElement>(null);
	// 初期値（開き直したとき）に合わせる。マウント時だけでよい
	useLayoutEffect(() => {
		if (ref.current) fitHeight(ref.current);
	}, []);
	return (
		<textarea
			ref={ref}
			rows={2}
			maxLength={2000}
			value={value}
			onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
				fitHeight(e.target);
				e.target.scrollIntoView({ block: "nearest" });
				onChange(e.target.value);
			}}
			aria-label={label}
			className={`${inputClass} resize-none overflow-hidden`}
		/>
	);
}

/**
 * 尺（秒）。type="number" は「2.」のような入力途中で値が空になり小数が打てないので、
 * text ＋ inputmode=decimal にして文字列をここで持ち、0 以上の数になったときだけ親に渡す
 */
function DurationInput({
	value,
	onChange,
}: {
	value: number | null;
	onChange: (value: number | null) => void;
}) {
	const [text, setText] = useState(value === null ? "" : String(value));
	const trimmed = text.trim();
	const parsed = trimmed === "" ? null : Number(trimmed);
	const invalid = parsed !== null && !(Number.isFinite(parsed) && parsed >= 0);
	return (
		<div className="flex items-center gap-2">
			<input
				value={text}
				inputMode="decimal"
				onChange={(e) => {
					const next = e.target.value;
					setText(next);
					const t = next.trim();
					if (t === "") {
						onChange(null);
						return;
					}
					const n = Number(t);
					if (Number.isFinite(n) && n >= 0) onChange(n);
				}}
				aria-label="尺（秒）"
				aria-invalid={invalid}
				className={`${fieldClass(invalid)} w-28`}
			/>
			<span>秒</span>
		</div>
	);
}
