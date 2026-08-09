import { restoreHaproxyConfig } from "./haproxy-config";

export default function globalTeardown() {
	restoreHaproxyConfig();
}
