import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	server: {
		port: 5173,
		strictPort: true,
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./src/test/setup.js"],
		include: ["src/**/*.{test,spec}.{js,jsx}"],
		clearMocks: true,
		restoreMocks: true,
	},
});
