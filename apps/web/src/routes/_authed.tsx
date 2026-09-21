import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { sessionQuery } from "../api/client";

export const Route = createFileRoute("/_authed")({
	beforeLoad: async ({ context, location }) => {
		const session = await context.queryClient.ensureQueryData(sessionQuery);
		if (!session.loggedIn) {
			throw redirect({ to: "/login", search: { redirect: location.href } });
		}
	},
	component: () => <Outlet />,
});
