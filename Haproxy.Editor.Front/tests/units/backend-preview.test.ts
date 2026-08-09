import { describe, expect, it } from "vitest";
import { buildBackendPreview } from "@components/management/BackendManagementSection";
import { createEmptySnapshot } from "@modules/config/config.utils";
import type { HaproxyBackendResource } from "@modules/config/config.types";

function createBackend(overrides: Partial<HaproxyBackendResource> = {}): HaproxyBackendResource {
	return {
		name: "be_main",
		mode: "http",
		balance: "roundrobin",
		advCheck: null,
		defaultServer: null,
		servers: [],
		extra: null,
		...overrides,
	};
}

describe("buildBackendPreview", () => {
	it("renders ssl and verify on the server line", () => {
		const backend = createBackend({
			servers: [{ name: "app_1", address: "10.0.0.10", port: 443, check: "enabled", ssl: "enabled", verify: "none", extra: null }],
		});

		expect(buildBackendPreview(backend, createEmptySnapshot())).toContain("server app_1 10.0.0.10:443 check ssl verify none");
	});

	it("renders the default-server line only when something is set on it", () => {
		const withoutSettings = createBackend({ defaultServer: { ssl: null, verify: null, extra: null } });
		expect(buildBackendPreview(withoutSettings, createEmptySnapshot())).not.toContain("default-server");

		const withSettings = createBackend({ defaultServer: { ssl: "enabled", verify: "none", extra: null } });
		expect(buildBackendPreview(withSettings, createEmptySnapshot())).toContain("    default-server ssl verify none");
	});

	it("renders scalar advanced options and counts the nested ones", () => {
		const backend = createBackend({
			extra: '{"connect_timeout":4000,"cookie":{"name":"srv"}}',
			servers: [{ name: "app_1", address: "10.0.0.10", port: 8080, check: null, ssl: null, verify: null, extra: '{"stick":{"x":1},"weight":10}' }],
		});

		const preview = buildBackendPreview(backend, createEmptySnapshot());

		expect(preview).toContain("    connect-timeout 4000");
		expect(preview).toContain("    # cookie (nested value)");
		expect(preview).toContain("server app_1 10.0.0.10:8080 weight 10 # +1 nested");
	});
});
