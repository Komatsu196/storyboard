import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		name: "unit",
		environment: "node",
		include: ["shared/**/*.test.ts", "server/**/*.test.ts"],
		exclude: ["**/*.api.test.ts", "**/node_modules/**"],
		passWithNoTests: true,
	},
});
