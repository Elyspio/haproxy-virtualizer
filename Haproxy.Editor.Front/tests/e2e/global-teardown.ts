/// <reference types="node" />

import { env } from "process";
import { removeTemporaryHaproxyConfig } from "./haproxy-config";

export default function globalTeardown() {
	removeTemporaryHaproxyConfig(env.PLAYWRIGHT_HAPROXY_CONFIG_PATH);
}
