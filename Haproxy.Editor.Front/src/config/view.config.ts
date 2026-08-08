type PartialRecord<K extends PropertyKey, T> = Partial<Record<K, T>>;

export type Route = {
	path: string;
};

export const routes = {
	dashboard: {
		summary: {
			path: "/",
		},
		flow: {
			path: "/flow",
		},
		management: {
			path: "/workspace",
		},
	},
	frontend: {
		create: {
			path: "frontend/create",
		},
		edit: {
			path: "frontend/edit",
		},
	},
	backend: {
		create: {
			path: "backend/create",
		},
		edit: {
			path: "backend/edit",
		},
	},
	global: {
		edit: {
			path: "global/edit",
		},
	},
	raw: {
		view: {
			path: "/raw",
		},
	},
	default: {
		edit: {
			path: "default/edit",
		},
	},
	oauth: {
		callback: {
			path: "oauth/callback",
		},
		error: {
			path: "oauth/error",
		},
		logout: {
			path: "oauth/logout",
		},
		login: {
			path: "oauth/login",
		},
	},
} satisfies Record<string, Record<string, Route>>;

export type Routes = typeof routes;

export const navigateToRoute = {
	root: () => window["haproxy-editor"].router.navigate(routes.dashboard.summary.path),
	oauth: {
		login: () => window["haproxy-editor"].router.navigate(routes.oauth.login.path),
	},
} satisfies {
	oauth: PartialRecord<keyof Routes["oauth"], (...args: any[]) => Promise<void>>;
	root: () => Promise<void>;
};
