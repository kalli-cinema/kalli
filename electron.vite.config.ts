import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

// Ubuntu 24.04+ blocks unprivileged user namespaces, and Chromium aborts instead of starting without its sandbox.
// Same probe and fallback as electron-builder's AppImage launcher; the .deb installs an AppArmor profile instead.
if (
	process.platform === "linux" &&
	spawnSync("unshare", ["-Ur", "true"]).status !== 0
)
	process.env.NO_SANDBOX = "1";

export default defineConfig({
	main: {},
	preload: {},
	renderer: {
		// `@/` is the shadcn alias the coss components are generated with (components.json).
		resolve: { alias: { "@": resolve("src/renderer/src") } },
		plugins: [react(), tailwindcss()],
	},
});
