import { backupHaproxyConfig } from "./haproxy-config";

export default function globalSetup() {
	backupHaproxyConfig();
}
