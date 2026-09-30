import { Link } from "@tanstack/react-router";

export function NotFound() {
	return (
		<main className="p-4">
			<p>見つかりません</p>
			<Link to="/" className="mt-2 inline-block text-accent underline">
				作品一覧へ
			</Link>
		</main>
	);
}
