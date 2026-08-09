import { copyFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const configDirectory = fileURLToPath(new URL("../../../Haproxy.Editor.AppHost/haproxy/", import.meta.url));

/**
 * `Haproxy.Editor.AppHost/haproxy` is bind-mounted read-write into the HAProxy container and holds a real production
 * configuration. `haproxy.cfg` is rewritten by every save the suite performs, and `haproxy.cfg.lkg` is rewritten by the
 * Data Plane API on every successful reload, so both are saved and restored around the run.
 */
const guardedFiles = ["haproxy.cfg", "haproxy.cfg.lkg"];

const backupSuffix = ".e2e-backup";

export function backupHaproxyConfig() {
	for (const file of guardedFiles) {
		if (existsSync(`${configDirectory}${file}`)) {
			copyFileSync(`${configDirectory}${file}`, `${configDirectory}${file}${backupSuffix}`);
		}
	}
}

export function restoreHaproxyConfig() {
	for (const file of guardedFiles) {
		const backup = `${configDirectory}${file}${backupSuffix}`;

		if (!existsSync(backup)) {
			continue;
		}

		copyFileSync(backup, `${configDirectory}${file}`);
		rmSync(backup);
	}
}
