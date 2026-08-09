import { getDefaultConfig } from "@elyspio/vite-eslint-config";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

const config = getDefaultConfig({ basePath: __dirname, port: 3000 });

config.server ??= {};

const apiUrl = process.env.services__api__https__0 ?? "https://localhost:7252";

config.server.proxy = {
	"/api": {
		target: apiUrl,
		changeOrigin: true,
		secure: false,
		rewrite: (path: string) => path.slice("/api".length),
	},
};

export default {
	...config,
	test: {
		environment: "jsdom",
		// Playwright owns `tests/e2e`; without this Vitest would try to run those specs too.
		include: ["tests/units/**/*.{test,spec}.{ts,tsx}"],
	},
};
