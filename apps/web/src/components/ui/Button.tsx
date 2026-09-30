import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

const base =
	"inline-flex touch-manipulation items-center justify-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-40";

// ghost は文字色を持たない（親から継ぐ。className="text-danger" で赤くできる）
const variants: Record<ButtonVariant, string> = {
	primary:
		"bg-accent font-bold text-white hover:bg-accent-hover active:bg-accent-hover",
	secondary:
		"border border-line-strong bg-surface text-ink hover:bg-canvas active:bg-line",
	danger:
		"border border-danger/40 bg-surface text-danger hover:bg-danger/5 active:bg-danger/10",
	ghost: "hover:bg-line/60 active:bg-line",
};

// 44px 以上のタップ目標（sm はシーン見出しの「＋カット」だけ、lg は画面下固定の「＋カット」だけ）
const sizes: Record<ButtonSize, string> = {
	sm: "min-h-9 min-w-9 px-2.5 text-sm",
	md: "min-h-11 min-w-11 px-3 text-sm",
	lg: "min-h-12 min-w-12 px-5 text-base",
};
const iconOnlySizes: Record<ButtonSize, string> = {
	sm: "min-h-9 min-w-9",
	md: "min-h-11 min-w-11",
	lg: "min-h-12 min-w-12",
};

/**
 * ボタンの見た目（T-026、設計書 §5.7）。<Link> をボタンの見た目にするときもこれを使う。
 * className で足してよいのは配置・余白・位置と ghost の文字色だけ。色・角丸・高さ・左右の余白・文字サイズはここで決める
 */
export function buttonClass({
	variant = "secondary",
	size = "md",
	pill = false,
	iconOnly = false,
}: {
	variant?: ButtonVariant;
	size?: ButtonSize;
	pill?: boolean;
	iconOnly?: boolean;
} = {}): string {
	return `${base} ${variants[variant]} ${iconOnly ? iconOnlySizes[size] : sizes[size]} ${pill ? "rounded-full" : "rounded-md"}`;
}

type Common = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
	variant?: ButtonVariant;
	size?: ButtonSize;
	pill?: boolean;
};

/** 文字のボタン（アイコンを添えてもよい）か、アイコンだけのボタン（aria-label 必須） */
export type ButtonProps =
	| (Common & { children: ReactNode; icon?: LucideIcon })
	| (Common & { children?: undefined; icon: LucideIcon; "aria-label": string });

export function Button({
	variant,
	size,
	pill,
	icon: Icon,
	children,
	className = "",
	type = "button",
	title,
	...rest
}: ButtonProps) {
	const iconOnly = children === undefined;
	return (
		<button
			type={type}
			title={title ?? (iconOnly ? rest["aria-label"] : undefined)}
			className={`${buttonClass({ variant, size, pill, iconOnly })} ${className}`}
			{...rest}
		>
			{Icon && <Icon aria-hidden className="size-5 shrink-0" />}
			{children}
		</button>
	);
}
