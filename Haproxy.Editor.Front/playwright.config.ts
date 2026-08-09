/// <reference types="node" />

import { defineConfig } from "@playwright/test";
import process from "process";
import { isTemporaryHaproxyConfig, prepareTemporaryHaproxyConfig } from "./tests/e2e/haproxy-config";

const temporaryConfigEnvironmentVariable = "PLAYWRIGHT_HAPROXY_CONFIG_PATH";
const haproxyConfigPath = resolveHaproxyConfigPath();
if (haproxyConfigPath) process.env[temporaryConfigEnvironmentVariable] = haproxyConfigPath;

function resolveHaproxyConfigPath() {
	if (process.argv.includes("--list")) return undefined;
	const existingPath = process.env[temporaryConfigEnvironmentVariable];
	return isTemporaryHaproxyConfig(existingPath) ? existingPath : prepareTemporaryHaproxyConfig();
}

export default defineConfig({
	testDir: "./tests/e2e",
	// The suite drives one shared HAProxy configuration, so the specs must not race each other.
	workers: 1,
	fullyParallel: false,
	// Aspire boots MongoDB, Keycloak and the HAProxy container; a first cold run is slow.
	timeout: 180_000,
	expect: { timeout: 30_000 },
	reporter: "list",
	globalTeardown: haproxyConfigPath ? "./tests/e2e/global-teardown.ts" : undefined,
	use: {
		baseURL: "https://localhost:3000",
		// The dev server and the API both use locally generated certificates.
		ignoreHTTPSErrors: true,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	webServer: haproxyConfigPath
		? {
				// Starts an isolated stack, frontend included.
				command: "aspire run",
				// Relative to this configuration file, i.e. the repository root.
				cwd: "..",
				url: "https://localhost:3000",
				ignoreHTTPSErrors: true,
				// An existing stack could still bind-mount the tracked production configuration.
				reuseExistingServer: false,
				env: { HAPROXY_CONFIG_PATH: haproxyConfigPath },
				timeout: 600_000,
				stdout: "pipe",
				stderr: "pipe",
			}
		: undefined,
});
