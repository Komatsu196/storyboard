import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: () => <main className="p-4">Storyboard</main>,
});
