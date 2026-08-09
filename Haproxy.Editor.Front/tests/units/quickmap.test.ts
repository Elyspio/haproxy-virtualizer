import { describe, expect, it } from "vitest";
import { createAclClause, createGroupClause, serializeConditionExpression } from "@components/management/condition-expression.utils";
import { buildAclFromPresetState, createUniqueAclName } from "@components/management/acl.utils";
import { deriveAclNameFromValue } from "@components/management/QuickMapSection";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";

function buildExpressionPreview(generatedAclName: string, extraAclNames: string[], combineOperator: "and" | "or", hasMatch: boolean): string {
	const allAclNames = hasMatch ? [generatedAclName, ...extraAclNames] : [...extraAclNames];

	if (allAclNames.length === 0) {
		return "";
	}

	if (allAclNames.length === 1) {
		return allAclNames[0];
	}

	const clauses = allAclNames.map((name) => createAclClause(name));
	const root = createGroupClause(combineOperator, clauses);
	return serializeConditionExpression({ kind: "tree", root });
}

function createTestSnapshot(overrides?: Partial<HaproxyResourceSnapshot>): HaproxyResourceSnapshot {
	return {
		version: 1,
		global: { daemon: true },
		defaults: [{ name: "defaults", mode: "http" }],
		frontends: [
			{
				name: "fe_main",
				mode: "http",
				defaultBackend: null,
				binds: [{ name: "fe_main_bind", address: "0.0.0.0", port: 80, extra: null }],
				acls: [
					{ name: "is_auth", criterion: "path_beg", value: "/auth" },
					{ name: "is_admin", criterion: "hdr(host)", value: "-i admin.example.com" },
				],
				backendSwitchingRules: [],
				extra: null,
			},
		],
		backends: [
			{
				name: "be_api",
				mode: "http",
				balance: "roundrobin",
				advCheck: null,
				defaultServer: null,
				servers: [{ name: "srv_1", address: "10.0.0.1", port: 8080, check: "enabled", ssl: null, verify: null, extra: null }],
				extra: null,
			},
		],
		summary: { frontendCount: 1, backendCount: 1, serverCount: 1 },
		...overrides,
	};
}

describe("Quick Map logic", () => {
	describe("expression preview", () => {
		it("returns the ACL name when only a route match is provided", () => {
			expect(buildExpressionPreview("host_acl", [], "and", true)).toBe("host_acl");
		});

		it("returns the extra ACL name when only extras are selected", () => {
			expect(buildExpressionPreview("host_acl", ["is_auth"], "and", false)).toBe("is_auth");
		});

		it("combines route ACL with extras using AND", () => {
			expect(buildExpressionPreview("host_acl", ["is_auth"], "and", true)).toBe("host_acl is_auth");
		});

		it("combines route ACL with extras using OR", () => {
			expect(buildExpressionPreview("host_acl", ["is_auth"], "or", true)).toBe("host_acl or is_auth");
		});

		it("combines route ACL with multiple extras", () => {
			expect(buildExpressionPreview("host_acl", ["is_auth", "is_admin"], "and", true)).toBe("host_acl is_auth is_admin");
		});

		it("returns empty string when nothing is provided", () => {
			expect(buildExpressionPreview("host_acl", [], "and", false)).toBe("");
		});
	});

	describe("ACL name generation", () => {
		it("generates a unique ACL name", () => {
			const snapshot = createTestSnapshot();
			const existingNames = snapshot.frontends[0].acls.map((acl) => acl.name);

			expect(createUniqueAclName(existingNames, "host_acl")).toBe("host_acl");
			expect(createUniqueAclName(existingNames, "is_auth")).toBe("is_auth_2");
		});
	});

	describe("ACL preset building", () => {
		it("builds a host ACL", () => {
			const acl = buildAclFromPresetState({ preset: "host", primary: "example.com", secondary: "" });
			expect(acl.criterion).toBe("hdr(host)");
			expect(acl.value).toBe("-i example.com");
		});

		it("builds a path prefix ACL", () => {
			const acl = buildAclFromPresetState({ preset: "path_prefix", primary: "/api", secondary: "" });
			expect(acl.criterion).toBe("path_beg");
			expect(acl.value).toBe("/api");
		});
	});

	describe("deriveAclNameFromValue", () => {
		it("converts hostname to valid ACL name with prefix", () => {
			expect(deriveAclNameFromValue("host", "api.example.com")).toBe("host_api_example_com");
		});

		it("converts path to valid ACL name with prefix", () => {
			expect(deriveAclNameFromValue("path_prefix", "/api/v2")).toBe("path_prefix_api_v2");
		});

		it("returns empty string for empty input", () => {
			expect(deriveAclNameFromValue("host", "")).toBe("");
		});

		it("strips leading non-alpha characters", () => {
			expect(deriveAclNameFromValue("host", "123test.com")).toBe("host_test_com");
		});

		it("skips prefix for custom type", () => {
			expect(deriveAclNameFromValue("custom", "my_criterion")).toBe("my_criterion");
		});
	});

	describe("submit simulation", () => {
		it("creates backend + ACL + rule in the snapshot", () => {
			const snapshot = createTestSnapshot();
			const frontendName = "fe_main";
			const newBackendName = "be_new";
			const matchType = "host";
			const matchPrimary = "api.example.com";
			const extraAclNames = ["is_auth"];
			const combineOperator = "and" as const;

			const existingAclNames = snapshot.frontends[0].acls.map((acl) => acl.name);
			const generatedAclName = createUniqueAclName(existingAclNames, `${matchType}_acl`);
			const expression = buildExpressionPreview(generatedAclName, extraAclNames, combineOperator, true);

			// Simulate submit
			snapshot.backends.push({
				name: newBackendName,
				mode: "http",
				balance: "roundrobin",
				advCheck: null,
				defaultServer: null,
				servers: [{ name: `${newBackendName}_srv_1`, address: "10.0.0.2", port: 3000, check: "enabled", ssl: null, verify: null, extra: null }],
				extra: null,
			});

			const frontend = snapshot.frontends.find((f) => f.name === frontendName)!;
			const aclData = buildAclFromPresetState({ preset: matchType, primary: matchPrimary, secondary: "" });
			frontend.acls.push({ name: generatedAclName, criterion: aclData.criterion, value: aclData.value });
			frontend.backendSwitchingRules.push({ backendName: newBackendName, cond: "if", condTest: expression });

			// Assertions
			expect(snapshot.backends).toHaveLength(2);
			expect(snapshot.backends[1].name).toBe("be_new");
			expect(frontend.acls).toHaveLength(3);
			expect(frontend.acls[2]).toMatchObject({ name: "host_acl", criterion: "hdr(host)", value: "-i api.example.com" });
			expect(frontend.backendSwitchingRules).toHaveLength(1);
			expect(frontend.backendSwitchingRules[0]).toMatchObject({
				backendName: "be_new",
				cond: "if",
				condTest: "host_acl is_auth",
			});
		});
	});
});
