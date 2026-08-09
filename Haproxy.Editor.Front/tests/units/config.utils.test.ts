import { describe, expect, it } from "vitest";
import { createEmptySnapshot, normalizeSnapshot, parseExtra, serializeExtra, snapshotsEqual, withSnapshot } from "@modules/config/config.utils";

describe("config.utils", () => {
	it("normalizes a raw API payload into a typed snapshot and recalculates summary", () => {
		const snapshot = normalizeSnapshot({
			version: "12",
			global: { daemon: true },
			frontends: [
				{
					name: "fe_main",
					mode: "http",
					defaultBackend: "be_main",
					binds: [{ name: "public", address: "0.0.0.0", port: 80 }],
					acls: [{ name: "host_acl", criterion: "hdr(host)", value: "example.com" }],
					backendSwitchingRules: [{ backendName: "be_main", cond: "if", condTest: "host_acl" }],
				},
			],
			backends: [
				{
					name: "be_main",
					mode: "http",
					balance: "roundrobin",
					advCheck: "tcp-check",
					servers: [
						{ name: "app_1", address: "10.0.0.10", port: 8080, check: "enabled" },
						{ name: "app_2", address: "10.0.0.11", port: 8080, check: null },
					],
				},
			],
		});

		expect(snapshot.version).toBe(12);
		expect(snapshot.global.daemon).toBe(true);
		expect(snapshot.frontends[0]?.backendSwitchingRules[0]?.backendName).toBe("be_main");
		expect(snapshot.backends[0]?.advCheck).toBe("tcp-check");
		expect(snapshot.summary).toEqual({
			frontendCount: 1,
			backendCount: 1,
			serverCount: 2,
		});
	});

	it("keeps advanced options, ssl settings and the default server across normalization", () => {
		const snapshot = normalizeSnapshot({
			version: 1,
			frontends: [
				{
					name: "fe_main",
					binds: [{ name: "public", address: "0.0.0.0", port: 443, extra: '{"ssl":true,"crt":"/certs/site.pem"}' }],
					extra: '{"maxconn":2000}',
				},
			],
			backends: [
				{
					name: "be_main",
					defaultServer: { ssl: "enabled", verify: "none", extra: '{"maxconn":40}' },
					servers: [{ name: "app_1", address: "10.0.0.10", port: 443, ssl: "enabled", verify: "none", extra: '{"weight":10}' }],
					extra: '{"retries":5}',
				},
			],
		});

		expect(snapshot.frontends[0]?.extra).toBe('{"maxconn":2000}');
		// Keys are re-sorted so the payload matches the canonical form the API compares against.
		expect(snapshot.frontends[0]?.binds[0]?.extra).toBe('{"crt":"/certs/site.pem","ssl":true}');
		expect(snapshot.backends[0]?.extra).toBe('{"retries":5}');
		expect(snapshot.backends[0]?.defaultServer).toEqual({ ssl: "enabled", verify: "none", extra: '{"maxconn":40}' });
		expect(snapshot.backends[0]?.servers[0]?.ssl).toBe("enabled");
		expect(snapshot.backends[0]?.servers[0]?.verify).toBe("none");
		expect(snapshot.backends[0]?.servers[0]?.extra).toBe('{"weight":10}');
	});

	it("round-trips advanced options through a canonical form", () => {
		expect(serializeExtra({ retries: 5, connect_timeout: 4000 })).toBe('{"connect_timeout":4000,"retries":5}');
		expect(serializeExtra({})).toBeNull();
		expect(serializeExtra({ retries: null })).toBeNull();
		expect(parseExtra('{"retries":5}')).toEqual({ retries: 5 });
		expect(parseExtra(null)).toEqual({});
		expect(parseExtra("not json")).toEqual({});
	});

	it("withSnapshot clones state before applying edits and keeps summary in sync", () => {
		const current = createEmptySnapshot();
		const next = withSnapshot(current, (draft) => {
			draft.frontends.push({
				name: "fe_main",
				mode: "http",
				defaultBackend: null,
				binds: [{ name: "public", address: "127.0.0.1", port: 80, extra: null }],
				acls: [],
				backendSwitchingRules: [{ backendName: "be_main", cond: "if", condTest: "host_acl" }],
				extra: null,
			});
			draft.backends.push({
				name: "be_main",
				mode: "http",
				balance: null,
				advCheck: null,
				defaultServer: null,
				servers: [{ name: "app_1", address: "10.0.0.10", port: 8080, check: null, ssl: null, verify: null, extra: null }],
				extra: null,
			});
		});

		expect(current.frontends).toHaveLength(0);
		expect(current.backends).toHaveLength(0);
		expect(next.summary).toEqual({
			frontendCount: 1,
			backendCount: 1,
			serverCount: 1,
		});
	});

	it("detects whether a configuration draft differs from its saved baseline", () => {
		const baseline = createEmptySnapshot();
		const unchangedDraft = structuredClone(baseline);
		const changedDraft = withSnapshot(baseline, (draft) => {
			draft.global.daemon = true;
		});

		expect(snapshotsEqual(baseline, unchangedDraft)).toBe(true);
		expect(snapshotsEqual(baseline, changedDraft)).toBe(false);
	});
});
