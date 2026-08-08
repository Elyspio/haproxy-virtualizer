import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import type {
	DashboardAlert,
	DashboardKpi,
	DashboardSearchResult,
	DashboardSelection,
	DashboardSnapshot,
	FlowViewMode,
	RuntimeBackendStatus,
	RuntimeServerStatus,
	ThemeMode,
} from "./dashboard.types";
import { routes } from "@/config/view.config";

export const THEME_STORAGE_KEY = "haproxy-editor.theme-mode";

function asString(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asStringOrFallback(value: unknown, fallback = ""): string {
	return asString(value) ?? fallback;
}

function asEnumString(value: unknown, fallback = "unknown"): string {
	return asString(value)?.toLowerCase() ?? fallback;
}

function asNumber(value: unknown): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return 0;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function ensureKpi(value: unknown, title: string): DashboardKpi {
	const item = asRecord(value);
	return {
		title: asStringOrFallback(item.title, title),
		value: asNumber(item.value),
		subtitle: asStringOrFallback(item.subtitle),
		tone: asEnumString(item.tone, "neutral"),
		trend: Array.isArray(item.trend) ? item.trend.map(asNumber) : [],
	};
}

function ensureAlerts(value: unknown): DashboardAlert[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			id: asStringOrFallback(item.id),
			severity: asEnumString(item.severity, "info"),
			message: asStringOrFallback(item.message),
			resourceType: asString(item.resourceType)?.toLowerCase() ?? null,
			resourceName: asString(item.resourceName),
		};
	});
}

function ensureServers(value: unknown): RuntimeServerStatus[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			status: asEnumString(item.status),
			address: asString(item.address),
			port: item.port == null ? null : asNumber(item.port),
			adminState: asString(item.adminState)?.toLowerCase() ?? null,
			operationalState: asString(item.operationalState)?.toLowerCase() ?? null,
			checkStatus: asString(item.checkStatus)?.toLowerCase() ?? null,
			currentSessions: asNumber(item.currentSessions),
			sessionRate: asNumber(item.sessionRate),
		};
	});
}

function ensureBackends(value: unknown): RuntimeBackendStatus[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			status: asEnumString(item.status),
			currentSessions: asNumber(item.currentSessions),
			sessionRate: asNumber(item.sessionRate),
			bytesIn: asNumber(item.bytesIn),
			bytesOut: asNumber(item.bytesOut),
			healthyServers: asNumber(item.healthyServers),
			downServers: asNumber(item.downServers),
			maintenanceServers: asNumber(item.maintenanceServers),
			servers: ensureServers(item.servers),
		};
	});
}

export function createEmptyDashboardSnapshot(): DashboardSnapshot {
	return {
		summary: {
			generatedAt: new Date(0).toISOString(),
			runtimeStatus: "unknown",
			alerts: { title: "Alerts", value: 0, subtitle: "No active issues", tone: "neutral", trend: [0] },
			routes: { title: "Routes", value: 0, subtitle: "No switching rules", tone: "neutral", trend: [0] },
			services: { title: "Services", value: 0, subtitle: "No runtime data", tone: "neutral", trend: [0] },
		},
		alerts: [],
		backends: [],
	};
}

export function normalizeDashboardSnapshot(snapshot: unknown): DashboardSnapshot {
	const raw = asRecord(snapshot);
	const summary = asRecord(raw.summary);

	return {
		summary: {
			generatedAt: asStringOrFallback(summary.generatedAt, new Date(0).toISOString()),
			runtimeStatus: asEnumString(summary.runtimeStatus),
			alerts: { ...ensureKpi(summary.alerts, "Alerts"), tone: asEnumString(asRecord(summary.alerts).tone, "neutral") },
			routes: { ...ensureKpi(summary.routes, "Routes"), tone: asEnumString(asRecord(summary.routes).tone, "neutral") },
			services: { ...ensureKpi(summary.services, "Services"), tone: asEnumString(asRecord(summary.services).tone, "neutral") },
		},
		alerts: ensureAlerts(raw.alerts),
		backends: ensureBackends(raw.backends),
	};
}

export function getInitialThemeMode(): ThemeMode {
	if (typeof window === "undefined") {
		return "dark";
	}

	const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
	if (stored === "light" || stored === "dark") {
		return stored;
	}

	return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function scoreResult(query: string, title: string, subtitle: string) {
	const haystack = `${title} ${subtitle}`.toLowerCase();
	if (title.toLowerCase().startsWith(query)) {
		return 3;
	}
	if (haystack.includes(query)) {
		return 2;
	}
	return 0;
}

export function searchDashboardSnapshot(query: string, config: HaproxyResourceSnapshot, snapshot: DashboardSnapshot): DashboardSearchResult[] {
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) {
		return [];
	}

	const results: DashboardSearchResult[] = [
		{
			id: "route-summary",
			kind: "route",
			title: "Summary",
			subtitle: "Operational overview and active alerts",
			route: routes.dashboard.summary.path,
			selection: { section: "summary" },
		},
		{
			id: "route-management",
			kind: "route",
			title: "Management",
			subtitle: "Unified editing workspace",
			route: routes.dashboard.management.path,
			selection: { section: "mapping" },
		},
		{
			id: "route-flow",
			kind: "route",
			title: "Flow",
			subtitle: "Dedicated topology and runtime flow view",
			route: routes.dashboard.flow.path,
			selection: { section: "summary" },
		},
		{
			id: "route-raw",
			kind: "route",
			title: "Raw",
			subtitle: "Diagnostic JSON view",
			route: routes.raw.view.path,
			selection: { section: "raw" },
		},
		{
			id: "route-quickmap",
			kind: "route",
			title: "Quick Map",
			subtitle: "Quickly map a backend to a hostname or route",
			route: routes.dashboard.management.path,
			selection: { section: "quickmap" },
		},
	];

	for (const frontend of config.frontends) {
		results.push({
			id: `frontend-${frontend.name}`,
			kind: "frontend",
			title: frontend.name,
			subtitle: `Frontend ${frontend.mode ?? "tcp"} ${frontend.binds.map((bind) => `${bind.address ?? "*"}:${bind.port ?? ""}`).join(", ")}`.trim(),
			route: routes.dashboard.management.path,
			selection: { section: "frontend", frontendName: frontend.name },
		});

		for (const bind of frontend.binds) {
			results.push({
				id: `bind-${frontend.name}-${bind.name}`,
				kind: "bind",
				title: bind.name,
				subtitle: `Bind on ${frontend.name} ${bind.address ?? "*"}:${bind.port ?? ""}`.trim(),
				route: routes.dashboard.management.path,
				selection: { section: "frontend", frontendName: frontend.name },
			});
		}

		for (const rule of frontend.backendSwitchingRules) {
			results.push({
				id: `rule-${frontend.name}-${rule.backendName}`,
				kind: "rule",
				title: `${frontend.name} -> ${rule.backendName}`,
				subtitle: `Rule ${rule.cond ?? "if"} ${rule.condTest ?? ""}`.trim(),
				route: routes.dashboard.management.path,
				selection: { section: "mapping", frontendName: frontend.name, backendName: rule.backendName },
			});
		}

		for (const acl of frontend.acls) {
			results.push({
				id: `acl-${frontend.name}-${acl.name}`,
				kind: "acl",
				title: acl.name,
				subtitle: `${frontend.name} ${acl.criterion ?? ""} ${acl.value ?? ""}`.trim(),
				route: routes.dashboard.management.path,
				selection: { section: "acl", frontendName: frontend.name, aclName: acl.name },
			});
		}
	}

	for (const backend of config.backends) {
		const runtimeBackend = snapshot.backends.find((item) => item.name === backend.name);

		results.push({
			id: `backend-${backend.name}`,
			kind: "backend",
			title: backend.name,
			subtitle: `Backend ${backend.mode ?? "tcp"} ${runtimeBackend?.status ?? "unknown"}`.trim(),
			route: routes.dashboard.management.path,
			selection: { section: "backend", backendName: backend.name },
		});

		for (const server of backend.servers) {
			const runtimeServer = runtimeBackend?.servers.find((item) => item.name === server.name);
			results.push({
				id: `server-${backend.name}-${server.name}`,
				kind: "server",
				title: server.name,
				subtitle: `${backend.name} ${runtimeServer?.status ?? "unknown"} ${server.address ?? ""}:${server.port ?? ""}`.trim(),
				route: routes.dashboard.management.path,
				selection: { section: "backend", backendName: backend.name, serverName: server.name },
			});
		}
	}

	return results
		.map((result) => ({ result, score: scoreResult(normalizedQuery, result.title, result.subtitle) }))
		.filter((item) => item.score > 0)
		.sort((left, right) => right.score - left.score || left.result.title.localeCompare(right.result.title))
		.slice(0, 12)
		.map((item) => item.result);
}

export function resolveSelectionFromSearchParams(searchParams: URLSearchParams): DashboardSelection {
	const section = searchParams.get("section");
	const normalizedSection = section === "defaults" ? "global" : section;
	const selection: DashboardSelection = {
		section:
			normalizedSection === "summary" ||
			normalizedSection === "global" ||
			normalizedSection === "frontend" ||
			normalizedSection === "mapping" ||
			normalizedSection === "backend" ||
			normalizedSection === "acl" ||
			normalizedSection === "quickmap" ||
			normalizedSection === "raw"
				? normalizedSection
				: "global",
		frontendName: searchParams.get("frontend"),
		backendName: searchParams.get("backend"),
		aclName: searchParams.get("acl"),
		serverName: searchParams.get("server"),
	};

	return selection;
}

export function serializeSelection(selection: DashboardSelection) {
	const params = new URLSearchParams();
	params.set("section", selection.section);

	if (selection.frontendName) {
		params.set("frontend", selection.frontendName);
	}

	if (selection.backendName) {
		params.set("backend", selection.backendName);
	}

	if (selection.aclName) {
		params.set("acl", selection.aclName);
	}

	if (selection.serverName) {
		params.set("server", selection.serverName);
	}

	return params.toString();
}

export function ensureExistingSelection(selection: DashboardSelection, config: HaproxyResourceSnapshot): DashboardSelection {
	if (selection.section === "frontend" || selection.section === "mapping" || selection.section === "quickmap") {
		return {
			...selection,
			frontendName: config.frontends.some((item) => item.name === selection.frontendName) ? selection.frontendName : (config.frontends[0]?.name ?? null),
		};
	}

	if (selection.section === "backend") {
		return {
			...selection,
			backendName: config.backends.some((item) => item.name === selection.backendName) ? selection.backendName : (config.backends[0]?.name ?? null),
		};
	}

	if (selection.section === "acl") {
		const frontend = config.frontends.find((item) => item.name === selection.frontendName) ?? config.frontends.find((item) => item.acls.length > 0) ?? config.frontends[0];
		const acl = frontend?.acls.find((item) => item.name === selection.aclName) ?? frontend?.acls[0];
		return {
			section: "acl",
			frontendName: frontend?.name ?? null,
			aclName: acl?.name ?? null,
		};
	}

	return selection;
}

export function getFlowViewLabel(flowViewMode: FlowViewMode) {
	return flowViewMode === "logical" ? "Logical Flow" : "Infrastructure Topology";
}
