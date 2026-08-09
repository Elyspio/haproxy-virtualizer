export type HaproxyGlobalResource = {
	daemon: boolean;
};

export type HaproxyDefaultsResource = {
	name: string;
	mode: string | null;
};

/**
 * Every Data Plane API field this application does not model, kept as a canonical JSON object string (sorted keys, no
 * whitespace). Round-tripping it is what stops a save from wiping configuration the UI never showed, and is also how
 * custom options are written.
 */
export type HaproxyExtra = string | null;

export type HaproxyBindResource = {
	name: string;
	address: string | null;
	port: number | null;
	extra: HaproxyExtra;
};

export type HaproxyAclResource = {
	name: string;
	criterion: string | null;
	value: string | null;
};

export type HaproxyBackendSwitchingRuleResource = {
	backendName: string;
	cond: string | null;
	condTest: string | null;
};

export type HaproxyServerResource = {
	name: string;
	address: string | null;
	port: number | null;
	check: string | null;
	/** Enables TLS towards the server: `enabled` or `disabled`. */
	ssl: string | null;
	/** Peer certificate verification: `none` (accepts self-signed certificates) or `required`. */
	verify: string | null;
	extra: HaproxyExtra;
};

/** The `default-server` line of a backend: server parameters inherited by every server of that backend. */
export type HaproxyDefaultServerResource = {
	ssl: string | null;
	verify: string | null;
	extra: HaproxyExtra;
};

export type HaproxyFrontendResource = {
	name: string;
	mode: string | null;
	defaultBackend: string | null;
	binds: HaproxyBindResource[];
	acls: HaproxyAclResource[];
	backendSwitchingRules: HaproxyBackendSwitchingRuleResource[];
	extra: HaproxyExtra;
};

export type HaproxyBackendResource = {
	name: string;
	mode: string | null;
	balance: string | null;
	advCheck: string | null;
	defaultServer: HaproxyDefaultServerResource | null;
	servers: HaproxyServerResource[];
	extra: HaproxyExtra;
};

export type HaproxySummary = {
	frontendCount: number;
	backendCount: number;
	serverCount: number;
};

export type HaproxyResourceSnapshot = {
	version: number;
	global: HaproxyGlobalResource;
	defaults: HaproxyDefaultsResource[];
	frontends: HaproxyFrontendResource[];
	backends: HaproxyBackendResource[];
	summary: HaproxySummary;
};

export type HaproxySchemaSectionName = "backend" | "server" | "default-server" | "frontend" | "bind";

export type HaproxySchemaFieldType = "string" | "number" | "boolean" | "enum" | "complex";

export type HaproxySchemaField = {
	/** The Data Plane API field name, e.g. `connect_timeout`. */
	name: string;
	type: HaproxySchemaFieldType;
	enumValues: string[];
	/** `false` for denied fields: the value still round-trips, but the API refuses to change it. */
	writable: boolean;
	reason: string | null;
};

export type HaproxySchemaSection = {
	name: HaproxySchemaSectionName;
	fields: HaproxySchemaField[];
};

export type HaproxySchema = {
	sections: HaproxySchemaSection[];
};
