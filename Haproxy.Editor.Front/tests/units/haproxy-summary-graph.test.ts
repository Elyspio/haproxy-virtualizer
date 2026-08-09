import { describe, expect, it } from "vitest";
import { convertSnapshotToFlow } from "@components/summary/HaproxySummaryGraph";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";

describe("convertSnapshotToFlow", () => {
	it("builds frontend, backend and server nodes with matching edges", () => {
		const snapshot: HaproxyResourceSnapshot = {
			version: 1,
			global: { daemon: false },
			defaults: [],
			frontends: [
				{
					name: "fe_main",
					mode: "http",
					defaultBackend: "be_main",
					binds: [{ name: "public", address: "0.0.0.0", port: 80, extra: null }],
					acls: [{ name: "host_acl", criterion: "hdr(host)", value: "example.com" }],
					backendSwitchingRules: [{ backendName: "be_main", cond: "if", condTest: "host_acl" }],
					extra: null,
				},
			],
			backends: [
				{
					name: "be_main",
					mode: "http",
					balance: null,
					advCheck: null,
					defaultServer: null,
					servers: [{ name: "app_1", address: "10.0.0.10", port: 8080, check: "enabled", ssl: null, verify: null, extra: null }],
					extra: null,
				},
			],
			summary: { frontendCount: 1, backendCount: 1, serverCount: 1 },
		};

		const { nodes, edges } = convertSnapshotToFlow(snapshot);

		expect(nodes.map((node) => node.id)).toEqual(expect.arrayContaining(["frontend-fe_main", "backend-be_main", "backend-be_main-app_1"]));
		expect(edges.map((edge) => edge.id)).toEqual(expect.arrayContaining(["edge-fe_main-be_main", "edge-be_main-app_1"]));
	});
});
