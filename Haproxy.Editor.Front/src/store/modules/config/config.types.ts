export type HaproxyGlobalResource = {
	daemon: boolean;
};

export type HaproxyDefaultsResource = {
	name: string;
	mode: string | null;
};

export type HaproxyBindResource = {
	name: string;
	address: string | null;
	port: number | null;
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
};

export type HaproxyFrontendResource = {
	name: string;
	mode: string | null;
	defaultBackend: string | null;
	binds: HaproxyBindResource[];
	acls: HaproxyAclResource[];
	backendSwitchingRules: HaproxyBackendSwitchingRuleResource[];
};

export type HaproxyBackendResource = {
	name: string;
	mode: string | null;
	balance: string | null;
	advCheck: string | null;
	servers: HaproxyServerResource[];
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
