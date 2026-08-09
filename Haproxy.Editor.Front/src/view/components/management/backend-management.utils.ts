import type { HaproxyBackendResource, HaproxyResourceSnapshot, HaproxyServerResource } from "@modules/config/config.types";

export type BackendReference = {
	frontendName: string;
	source: "default_backend" | "use_backend";
};

export function createServer(name: string, port: number): HaproxyServerResource {
	return { name, address: "10.0.0.1", port, check: "enabled", ssl: null, verify: null, extra: null };
}

export function createBackendDraft(snapshot: HaproxyResourceSnapshot): HaproxyBackendResource {
	const names = new Set(snapshot.backends.map((backend) => backend.name));
	let index = 1;

	while (names.has(`backend_${index}`)) {
		index += 1;
	}

	const name = `backend_${index}`;
	return {
		name,
		mode: null,
		balance: "roundrobin",
		advCheck: null,
		defaultServer: null,
		servers: [createServer(`${name}_srv_1`, 8080)],
		extra: null,
	};
}

export function findBackendReferences(snapshot: HaproxyResourceSnapshot, backendName: string): BackendReference[] {
	return snapshot.frontends.flatMap((frontend) => {
		const references: BackendReference[] = [];

		if (frontend.defaultBackend === backendName) {
			references.push({ frontendName: frontend.name, source: "default_backend" });
		}

		if (frontend.backendSwitchingRules.some((rule) => rule.backendName === backendName)) {
			references.push({ frontendName: frontend.name, source: "use_backend" });
		}

		return references;
	});
}

export function validateBackendResources(snapshot: HaproxyResourceSnapshot): Record<string, string> {
	const errors: Record<string, string> = {};
	const backendNameCounts = new Map<string, number>();

	for (const backend of snapshot.backends) {
		const name = backend.name.trim();
		backendNameCounts.set(name, (backendNameCounts.get(name) ?? 0) + 1);
	}

	snapshot.backends.forEach((backend, backendIndex) => {
		const backendPath = `backends[${backendIndex}]`;
		const backendName = backend.name.trim();
		if (backendName === "") {
			errors[`${backendPath}.name`] = "Backend name is required.";
		} else if ((backendNameCounts.get(backendName) ?? 0) > 1) {
			errors[`${backendPath}.name`] = "Backend names must be unique.";
		}

		const serverNameCounts = new Map<string, number>();
		for (const server of backend.servers) {
			const name = server.name.trim();
			serverNameCounts.set(name, (serverNameCounts.get(name) ?? 0) + 1);
		}

		backend.servers.forEach((server, serverIndex) => {
			const serverPath = `${backendPath}.servers[${serverIndex}]`;
			const serverName = server.name.trim();
			if (serverName === "") {
				errors[`${serverPath}.name`] = "Server name is required.";
			} else if ((serverNameCounts.get(serverName) ?? 0) > 1) {
				errors[`${serverPath}.name`] = "Server names must be unique within a backend.";
			}

			if (!server.address?.trim()) {
				errors[`${serverPath}.address`] = "Address is required.";
			}

			if (!Number.isInteger(server.port) || (server.port ?? 0) < 1 || (server.port ?? 0) > 65535) {
				errors[`${serverPath}.port`] = "Port must be between 1 and 65535.";
			}
		});
	});

	return errors;
}

export function renameBackend(snapshot: HaproxyResourceSnapshot, currentName: string, nextName: string): void {
	const backend = snapshot.backends.find((item) => item.name === currentName);
	if (!backend) {
		return;
	}

	backend.name = nextName;
	for (const frontend of snapshot.frontends) {
		if (frontend.defaultBackend === currentName) {
			frontend.defaultBackend = nextName;
		}

		for (const rule of frontend.backendSwitchingRules) {
			if (rule.backendName === currentName) {
				rule.backendName = nextName;
			}
		}
	}
}
