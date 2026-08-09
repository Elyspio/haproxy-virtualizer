import type {
	HaproxyAclResource,
	HaproxyDefaultServerResource,
	HaproxyExtra,
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

/**
 * Reads an `extra` payload. Anything unparseable is treated as empty rather than thrown: the snapshot is rebuilt on every
 * keystroke through {@link withSnapshot}, so a throw here would take the whole editor down.
 */
export function parseExtra(extra: HaproxyExtra): Record<string, unknown> {
	if (!extra) {
		return {};
	}

	try {
		return asRecord(JSON.parse(extra));
	} catch {
		return {};
	}
}

/**
 * Writes an `extra` payload in the same canonical form the API produces — keys sorted, no whitespace, `null` when empty.
 * The API compares those strings to detect changes, so a differently ordered payload would look like an edit.
 */
export function serializeExtra(fields: Record<string, unknown>): HaproxyExtra {
	const entries = Object.entries(fields)
		.filter(([, value]) => value !== undefined && value !== null)
		.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

	return entries.length === 0 ? null : JSON.stringify(Object.fromEntries(entries));
}

function ensureExtra(value: unknown): HaproxyExtra {
	if (typeof value !== "string") {
		return null;
	}

	return serializeExtra(parseExtra(value));
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
			extra: ensureExtra(item.extra),
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
			ssl: asString(item.ssl),
			verify: asString(item.verify),
			extra: ensureExtra(item.extra),
		};
	});
}

function ensureDefaultServer(value: unknown): HaproxyDefaultServerResource | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return null;
	}

	const item = asRecord(value);
	return {
		ssl: asString(item.ssl),
		verify: asString(item.verify),
		extra: ensureExtra(item.extra),
	};
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
			extra: ensureExtra(item.extra),
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
			defaultServer: ensureDefaultServer(item.defaultServer),
			servers: ensureServers(item.servers),
			extra: ensureExtra(item.extra),
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
