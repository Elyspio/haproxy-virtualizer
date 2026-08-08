import type {
	HaproxyAclResource,
	HaproxyBackendResource,
	HaproxyBackendSwitchingRuleResource,
	HaproxyBindResource,
	HaproxyDefaultsResource,
	HaproxyFrontendResource,
	HaproxyGlobalResource,
	HaproxyResourceSnapshot,
	HaproxyServerResource,
} from "./config.types";

function asString(value: unknown): string | null {
	return typeof value === "string" && value.trim() !== "" ? value : null;
}

function asStringOrFallback(value: unknown, fallback = ""): string {
	return asString(value) ?? fallback;
}

function asNumber(value: unknown): number | null {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	return null;
}

function asBoolean(value: unknown): boolean {
	return value === true;
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function ensureGlobal(value: unknown): HaproxyGlobalResource {
	const item = asRecord(value);
	return {
		daemon: asBoolean(item.daemon),
	};
}

function ensureDefaults(value: unknown): HaproxyDefaultsResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			mode: asString(item.mode),
		};
	});
}

function ensureBinds(value: unknown): HaproxyBindResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			address: asString(item.address),
			port: asNumber(item.port),
		};
	});
}

function ensureAcls(value: unknown): HaproxyAclResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			criterion: asString(item.criterion),
			value: asString(item.value),
		};
	});
}

function ensureRules(value: unknown): HaproxyBackendSwitchingRuleResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			backendName: asStringOrFallback(item.backendName),
			cond: asString(item.cond),
			condTest: asString(item.condTest),
		};
	});
}

function ensureServers(value: unknown): HaproxyServerResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			address: asString(item.address),
			port: asNumber(item.port),
			check: asString(item.check),
		};
	});
}

function ensureFrontends(value: unknown): HaproxyFrontendResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			mode: asString(item.mode),
			defaultBackend: asString(item.defaultBackend),
			binds: ensureBinds(item.binds),
			acls: ensureAcls(item.acls),
			backendSwitchingRules: ensureRules(item.backendSwitchingRules),
		};
	});
}

function ensureBackends(value: unknown): HaproxyBackendResource[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.map((entry) => {
		const item = asRecord(entry);
		return {
			name: asStringOrFallback(item.name),
			mode: asString(item.mode),
			balance: asString(item.balance),
			advCheck: asString(item.advCheck),
			servers: ensureServers(item.servers),
		};
	});
}

export function createEmptySnapshot(): HaproxyResourceSnapshot {
	return {
		version: 0,
		global: {
			daemon: false,
		},
		defaults: [],
		frontends: [],
		backends: [],
		summary: {
			frontendCount: 0,
			backendCount: 0,
			serverCount: 0,
		},
	};
}

export function recalculateSummary(snapshot: HaproxyResourceSnapshot): HaproxyResourceSnapshot {
	return {
		...snapshot,
		summary: {
			frontendCount: snapshot.frontends.length,
			backendCount: snapshot.backends.length,
			serverCount: snapshot.backends.reduce((count, backend) => count + backend.servers.length, 0),
		},
	};
}

export function normalizeSnapshot(snapshot: unknown): HaproxyResourceSnapshot {
	const raw = asRecord(snapshot);
	return recalculateSummary({
		version: asNumber(raw.version) ?? 0,
		global: ensureGlobal(raw.global),
		defaults: ensureDefaults(raw.defaults),
		frontends: ensureFrontends(raw.frontends),
		backends: ensureBackends(raw.backends),
		summary: {
			frontendCount: 0,
			backendCount: 0,
			serverCount: 0,
		},
	});
}

export function cloneSnapshot(snapshot: HaproxyResourceSnapshot): HaproxyResourceSnapshot {
	return normalizeSnapshot(structuredClone(snapshot));
}

export function withSnapshot(current: HaproxyResourceSnapshot, updater: (draft: HaproxyResourceSnapshot) => void): HaproxyResourceSnapshot {
	const draft = cloneSnapshot(current);
	updater(draft);
	return recalculateSummary(draft);
}
