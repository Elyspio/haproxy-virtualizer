import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	// The suite drives one shared HAProxy configuration, so the specs must not race each other.
	workers: 1,
	fullyParallel: false,
	// Aspire boots MongoDB, Keycloak and the HAProxy container; a first cold run is slow.
	timeout: 180_000,
	expect: { timeout: 30_000 },
	reporter: "list",
	globalSetup: "./tests/e2e/global-setup.ts",
	globalTeardown: "./tests/e2e/global-teardown.ts",
	use: {
		baseURL: "https://localhost:3000",
		// The dev server and the API both use locally generated certificates.
		ignoreHTTPSErrors: true,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: {
		// Starts the whole stack, frontend included. Reused when a stack is already running.
		command: "aspire run",
		// Relative to this configuration file, i.e. the repository root.
		cwd: "..",
		url: "https://localhost:3000",
		ignoreHTTPSErrors: true,
		reuseExistingServer: true,
		timeout: 600_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
