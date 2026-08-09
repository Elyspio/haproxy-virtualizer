export type ThemeMode = "dark" | "light";
export type FlowViewMode = "logical" | "infrastructure";

export type DashboardKpi = {
	title: string;
	value: number;
	subtitle: string;
	tone: string;
	trend: number[];
};

export type DashboardAlert = {
	id: string;
	severity: string;
	message: string;
	resourceType: string | null;
	resourceName: string | null;
};

export type RuntimeServerStatus = {
	name: string;
	status: string;
	address: string | null;
	port: number | null;
	adminState: string | null;
	operationalState: string | null;
	checkStatus: string | null;
	currentSessions: number;
	sessionRate: number;
};

export type RuntimeBackendStatus = {
	name: string;
	status: string;
	currentSessions: number;
	sessionRate: number;
	bytesIn: number;
	bytesOut: number;
	healthyServers: number;
	downServers: number;
	maintenanceServers: number;
	servers: RuntimeServerStatus[];
};

export type DashboardSummary = {
	generatedAt: string;
	runtimeStatus: string;
	alerts: DashboardKpi;
	routes: DashboardKpi;
	services: DashboardKpi;
};

export type DashboardSnapshot = {
	summary: DashboardSummary;
	alerts: DashboardAlert[];
	backends: RuntimeBackendStatus[];
};

export type DashboardSelection = {
	section: "summary" | "global" | "defaults" | "frontend" | "mapping" | "backend" | "acl" | "quickmap" | "raw";
	frontendName?: string | null;
	backendName?: string | null;
	aclName?: string | null;
	serverName?: string | null;
};

export type DashboardSearchResult = {
	id: string;
	kind: "route" | "frontend" | "backend" | "server" | "acl" | "bind" | "rule";
	title: string;
	subtitle: string;
	route: string;
	selection: DashboardSelection;
};
