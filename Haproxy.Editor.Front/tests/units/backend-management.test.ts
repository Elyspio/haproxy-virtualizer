import { describe, expect, it } from "vitest";
import { createBackendDraft, findBackendReferences, renameBackend, validateBackendResources } from "@components/management/backend-management.utils";
import { createEmptySnapshot } from "@modules/config/config.utils";

describe("backend management", () => {
	it("creates a backend draft with the first available generated name", () => {
		const snapshot = createEmptySnapshot();
		snapshot.backends = [
			{ name: "backend_1", mode: null, balance: null, advCheck: null, defaultServer: null, servers: [], extra: null },
			{ name: "backend_3", mode: null, balance: null, advCheck: null, defaultServer: null, servers: [], extra: null },
		];

		expect(createBackendDraft(snapshot)).toEqual({
			name: "backend_2",
			mode: null,
			balance: "roundrobin",
			advCheck: null,
			defaultServer: null,
			servers: [
				{
					name: "backend_2_srv_1",
					address: "10.0.0.1",
					port: 8080,
					check: "enabled",
					ssl: null,
					verify: null,
					extra: null,
				},
			],
			extra: null,
		});
	});

	it("finds every frontend reference that blocks backend deletion", () => {
		const snapshot = createEmptySnapshot();
		snapshot.frontends = [
			{
				name: "public",
				mode: "http",
				defaultBackend: "be_main",
				binds: [],
				acls: [],
				backendSwitchingRules: [],
				extra: null,
			},
			{
				name: "internal",
				mode: "http",
				defaultBackend: null,
				binds: [],
				acls: [],
				backendSwitchingRules: [{ backendName: "be_main", cond: "if", condTest: "is_api" }],
				extra: null,
			},
		];

		expect(findBackendReferences(snapshot, "be_main")).toEqual([
			{ frontendName: "public", source: "default_backend" },
			{ frontendName: "internal", source: "use_backend" },
		]);
	});

	it("reports basic backend and server validation errors by editable field", () => {
		const snapshot = createEmptySnapshot();
		snapshot.backends = [
			{
				name: "duplicate",
				mode: "http",
				balance: null,
				advCheck: null,
				defaultServer: null,
				servers: [{ name: "", address: null, port: 0, check: null, ssl: null, verify: null, extra: null }],
				extra: null,
			},
			{ name: "duplicate", mode: null, balance: null, advCheck: null, defaultServer: null, servers: [], extra: null },
		];

		expect(validateBackendResources(snapshot)).toEqual({
			"backends[0].name": "Backend names must be unique.",
			"backends[0].servers[0].name": "Server name is required.",
			"backends[0].servers[0].address": "Address is required.",
			"backends[0].servers[0].port": "Port must be between 1 and 65535.",
			"backends[1].name": "Backend names must be unique.",
		});
	});

	it("renames a backend and every frontend reference atomically", () => {
		const snapshot = createEmptySnapshot();
		snapshot.backends = [{ name: "old", mode: null, balance: null, advCheck: null, defaultServer: null, servers: [], extra: null }];
		snapshot.frontends = [
			{
				name: "public",
				mode: "http",
				defaultBackend: "old",
				binds: [],
				acls: [],
				backendSwitchingRules: [{ backendName: "old", cond: "if", condTest: "is_api" }],
				extra: null,
			},
		];

		renameBackend(snapshot, "old", "new");

		expect(snapshot.backends[0]?.name).toBe("new");
		expect(snapshot.frontends[0]?.defaultBackend).toBe("new");
		expect(snapshot.frontends[0]?.backendSwitchingRules[0]?.backendName).toBe("new");
	});
});
