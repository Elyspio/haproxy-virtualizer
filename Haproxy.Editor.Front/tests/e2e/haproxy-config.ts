/// <reference types="node" />

import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceConfigDirectory = fileURLToPath(new URL("../../../Haproxy.Editor.AppHost/haproxy/", import.meta.url));
const temporaryDirectoryPrefix = "haproxy-editor-e2e-";

/**
 * The Data Plane API rewrites both `haproxy.cfg` and `haproxy.cfg.lkg`. Copying the whole directory also preserves the
 * auxiliary map, certificate and Data Plane configuration files without ever bind-mounting the tracked source writable.
 */
export function prepareTemporaryHaproxyConfig() {
	const temporaryRoot = mkdtempSync(join(tmpdir(), temporaryDirectoryPrefix));
	const configDirectory = join(temporaryRoot, "haproxy");
	cpSync(sourceConfigDirectory, configDirectory, { recursive: true });
	return configDirectory;
}

export function isTemporaryHaproxyConfig(configDirectory: string | undefined) {
	return configDirectory !== undefined && existsSync(configDirectory) && getTemporaryRoot(configDirectory) !== undefined;
}

export function removeTemporaryHaproxyConfig(configDirectory: string | undefined) {
	if (!configDirectory) return;

	const temporaryRoot = getTemporaryRoot(configDirectory);
	if (!temporaryRoot) throw new Error(`Refusing to remove non-E2E directory: ${configDirectory}`);

	rmSync(temporaryRoot, { recursive: true, force: true });
}

function getTemporaryRoot(configDirectory: string) {
	const resolvedConfigDirectory = resolve(configDirectory);
	const temporaryRoot = dirname(resolvedConfigDirectory);
	return basename(resolvedConfigDirectory) === "haproxy" && dirname(temporaryRoot) === resolve(tmpdir()) && basename(temporaryRoot).startsWith(temporaryDirectoryPrefix)
		? temporaryRoot
		: undefined;
}
