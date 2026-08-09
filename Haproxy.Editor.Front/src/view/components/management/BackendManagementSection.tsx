import { Add, DeleteOutline, DnsOutlined } from "@mui/icons-material";
import { Box, Button, Chip, Divider, List, ListItemButton, ListItemText, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type {
	HaproxyBackendResource,
	HaproxyDefaultServerResource,
	HaproxyExtra,
	HaproxyFrontendResource,
	HaproxyResourceSnapshot,
	HaproxyServerResource,
} from "@modules/config/config.types";
import type { DashboardSelection, RuntimeBackendStatus } from "@modules/dashboard/dashboard.types";
import { parseExtra } from "@modules/config/config.utils";
import { ConfigPreview, Panel, SectionHeader } from "./ManagementWorkspace.shared";
import { AdvancedOptionsEditor, useSchemaFields } from "./AdvancedOptionsEditor";

type BackendManagementSectionProps = {
	snapshot: HaproxyResourceSnapshot;
	runtimeBackends: RuntimeBackendStatus[];
	frontendContext: HaproxyFrontendResource | null;
	backendCandidates: HaproxyBackendResource[];
	selectedBackend: HaproxyBackendResource | null;
	selectedRuntimeBackend: RuntimeBackendStatus | null;
	shouldFilterBackendPanel: boolean;
	updateSnapshot: (updater: (draft: HaproxyResourceSnapshot) => void) => void;
	setSelection: (nextSelection: DashboardSelection) => void;
	focused: boolean;
};

const BACKEND_HEALTH_CHECK_OPTIONS = [
	{ value: "", label: "No backend option" },
	{ value: "tcp-check", label: "TCP check" },
	{ value: "httpchk", label: "HTTP check" },
];

const BALANCE_ALGORITHM_OPTIONS = [
	{ value: "roundrobin", label: "Round Robin", description: "Weighted round-robin" },
	{ value: "static-rr", label: "Static Round Robin", description: "Static weighted round-robin" },
	{ value: "leastconn", label: "Least Connections", description: "Fewest active connections" },
	{ value: "first", label: "First", description: "First available server" },
	{ value: "source", label: "Source", description: "Hash of source IP" },
	{ value: "uri", label: "URI", description: "Hash of request URI" },
	{ value: "url_param", label: "URL Parameter", description: "Hash of URL parameter" },
	{ value: "hdr", label: "Header", description: "Hash of HTTP header" },
	{ value: "random", label: "Random", description: "Random server selection" },
	{ value: "rdp-cookie", label: "RDP Cookie", description: "RDP cookie persistence" },
	{ value: "hash", label: "Hash", description: "Custom hash expression" },
];

const SERVER_CHECK_OPTIONS = [
	{ value: "enabled", label: "Enabled" },
	{ value: "disabled", label: "Disabled" },
];

const SERVER_SSL_OPTIONS = [
	{ value: "", label: "Not set" },
	{ value: "enabled", label: "Enabled" },
	{ value: "disabled", label: "Disabled" },
];

const SERVER_VERIFY_OPTIONS = [
	{ value: "", label: "Not set" },
	{ value: "none", label: "None (accept self-signed)" },
	{ value: "required", label: "Required" },
];

function createBackendName(snapshot: HaproxyResourceSnapshot): string {
	return `backend_${snapshot.backends.length + 1}`;
}

function createServerName(backendName: string, serverCount: number): string {
	return `${backendName}_srv_${serverCount + 1}`;
}

function createServer(name: string, port: number): HaproxyServerResource {
	return { name, address: "10.0.0.1", port, check: "enabled", ssl: null, verify: null, extra: null };
}

function renameBackendReferences(snapshot: HaproxyResourceSnapshot, currentName: string, nextName: string) {
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

function getDefaultMode(snapshot: HaproxyResourceSnapshot): string | null {
	return snapshot.defaults[0]?.mode ?? null;
}

function resolveBackendMode(backend: HaproxyBackendResource, snapshot: HaproxyResourceSnapshot): string | null {
	return backend.mode ?? getDefaultMode(snapshot);
}

/**
 * Renders the scalar advanced options as `key value` arguments. Nested ones cannot be spelled out on a single line, so
 * they are only counted — the preview stays honest about there being more than it shows.
 */
function buildExtraArguments(extra: HaproxyExtra): { args: string; nested: number } {
	const entries = Object.entries(parseExtra(extra)).sort(([left], [right]) => left.localeCompare(right));
	const scalars = entries.filter(([, value]) => typeof value !== "object" || value === null);

	return {
		args: scalars.map(([name, value]) => `${name.replaceAll("_", "-")} ${String(value)}`).join(" "),
		nested: entries.length - scalars.length,
	};
}

function buildSslArguments(resource: { ssl: string | null; verify: string | null }): string {
	const parts: string[] = [];

	if (resource.ssl === "enabled") parts.push("ssl");
	if (resource.ssl === "disabled") parts.push("no-ssl");
	if (resource.verify) parts.push(`verify ${resource.verify}`);

	return parts.join(" ");
}

function joinArguments(...parts: string[]): string {
	return parts.filter((part) => part !== "").join(" ");
}

function buildServerPreview(server: HaproxyServerResource): string {
	const address = server.address?.trim() || "0.0.0.0";
	const port = server.port ?? 0;
	const check = server.check === "enabled" ? "check" : "";
	const { args, nested } = buildExtraArguments(server.extra);
	const line = joinArguments(`    server ${server.name || "server_name"} ${address}:${port}`, check, buildSslArguments(server), args);

	return nested > 0 ? `${line} # +${nested} nested` : line;
}

function buildDefaultServerPreview(defaultServer: HaproxyDefaultServerResource): string | null {
	const { args, nested } = buildExtraArguments(defaultServer.extra);
	const line = joinArguments(buildSslArguments(defaultServer), args);

	if (line === "") {
		return null;
	}

	return nested > 0 ? `    default-server ${line} # +${nested} nested` : `    default-server ${line}`;
}

export function buildBackendPreview(backend: HaproxyBackendResource, snapshot: HaproxyResourceSnapshot): string {
	const lines = [`backend ${backend.name || "backend_name"}`];
	const effectiveMode = resolveBackendMode(backend, snapshot);

	if (effectiveMode) {
		lines.push(`    mode ${effectiveMode}`);
	}

	if (backend.balance) {
		lines.push(`    balance ${backend.balance}`);
	}

	if (backend.advCheck) {
		lines.push(`    option ${backend.advCheck}`);
	}

	for (const [name, value] of Object.entries(parseExtra(backend.extra)).sort(([left], [right]) => left.localeCompare(right))) {
		lines.push(typeof value === "object" && value !== null ? `    # ${name} (nested value)` : `    ${name.replaceAll("_", "-")} ${String(value)}`);
	}

	const defaultServerLine = backend.defaultServer ? buildDefaultServerPreview(backend.defaultServer) : null;
	if (defaultServerLine) {
		lines.push(defaultServerLine);
	}

	if (backend.servers.length === 0) {
		lines.push("    # add at least one server");
	}

	for (const server of backend.servers) {
		lines.push(buildServerPreview(server));
	}

	return lines.join("\n");
}

export function BackendManagementSection({
	snapshot,
	runtimeBackends,
	frontendContext,
	backendCandidates,
	selectedBackend,
	selectedRuntimeBackend,
	shouldFilterBackendPanel,
	updateSnapshot,
	setSelection,
	focused,
}: Readonly<BackendManagementSectionProps>) {
	const theme = useTheme();
	const defaultMode = getDefaultMode(snapshot);
	const backendFields = useSchemaFields("backend");
	const serverFields = useSchemaFields("server");
	const defaultServerFields = useSchemaFields("default-server");

	/** `default-server` is optional in HAProxy, so it is only materialised once something is actually set on it. */
	const updateDefaultServer = (backendName: string, patch: Partial<HaproxyDefaultServerResource>) =>
		updateSnapshot((draft) => {
			const backend = draft.backends.find((item) => item.name === backendName);
			if (!backend) return;

			const next = { ssl: null, verify: null, extra: null, ...backend.defaultServer, ...patch };
			backend.defaultServer = next.ssl === null && next.verify === null && next.extra === null ? null : next;
		});

	return (
		<Panel
			title="Backend Management"
			subtitle={
				shouldFilterBackendPanel && frontendContext
					? `${backendCandidates.length} linked backends for ${frontendContext.name}`
					: `${snapshot.backends.length} backends loaded`
			}
			icon={<DnsOutlined fontSize="small" />}
			focused={focused}
			actions={
				<Stack direction="row" spacing={1}>
					<Button
						size="small"
						variant="contained"
						startIcon={<Add fontSize="small" />}
						onClick={() => {
							const backendName = createBackendName(snapshot);
							updateSnapshot((draft) => {
								draft.backends.push({
									name: backendName,
									mode: null,
									balance: "roundrobin",
									advCheck: null,
									defaultServer: null,
									servers: [createServer(createServerName(backendName, 0), 8080)],
									extra: null,
								});
							});
							setSelection({ section: "backend", backendName, frontendName: shouldFilterBackendPanel ? frontendContext?.name : null });
						}}
					>
						Create
					</Button>
					<Button
						size="small"
						color="error"
						variant="outlined"
						startIcon={<DeleteOutline fontSize="small" />}
						disabled={!selectedBackend}
						onClick={() => {
							if (!selectedBackend) return;
							updateSnapshot((draft) => {
								draft.backends = draft.backends.filter((item) => item.name !== selectedBackend.name);
							});
							setSelection({ section: "backend", frontendName: shouldFilterBackendPanel ? frontendContext?.name : null });
						}}
					>
						Delete
					</Button>
				</Stack>
			}
		>
			<Box
				sx={{
					height: "100%",
					minHeight: 0,
					display: "grid",
					gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0, 1fr)" },
					gridTemplateRows: { xs: "auto 1fr", lg: "1fr" },
					overflow: "hidden",
				}}
			>
				<Box
					sx={{
						p: 1.5,
						borderBottom: { xs: `1px solid ${theme.palette.divider}`, lg: "none" },
						borderRight: { xs: "none", lg: `1px solid ${theme.palette.divider}` },
						overflow: "auto",
					}}
				>
					{shouldFilterBackendPanel && frontendContext ? (
						<Typography variant="body2" color="text.secondary" sx={{ mb: 1.25 }}>
							Showing only the backends linked from {frontendContext.name}.
						</Typography>
					) : null}
					<List disablePadding sx={{ display: "grid", gap: 1 }}>
						{backendCandidates.map((backend) => {
							const runtime = runtimeBackends.find((item) => item.name === backend.name);
							const effectiveMode = resolveBackendMode(backend, snapshot);
							return (
								<ListItemButton
									key={backend.name}
									data-testid={`backend-item-${backend.name}`}
									selected={selectedBackend?.name === backend.name}
									onClick={() =>
										setSelection({
											section: "backend",
											frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
											backendName: backend.name,
										})
									}
									sx={{
										border: `1px solid ${alpha(theme.palette.info.main, selectedBackend?.name === backend.name ? 0.35 : 0.12)}`,
										borderRadius: 2.5,
										alignItems: "flex-start",
									}}
								>
									<ListItemText
										primary={backend.name}
										secondary={
											<Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
												<Chip size="small" label={effectiveMode ?? "no mode"} variant={backend.mode ? "filled" : "outlined"} />
												<Chip size="small" label={`${backend.servers.length} servers`} />
												{backend.advCheck ? <Chip size="small" color="info" label={backend.advCheck} /> : null}
												<Chip size="small" color={runtime?.downServers ? "warning" : "success"} label={runtime?.status ?? "unknown"} />
											</Stack>
										}
									/>
								</ListItemButton>
							);
						})}
					</List>
				</Box>

				<Box sx={{ p: 2, overflow: "auto", minWidth: 0 }}>
					{selectedBackend ? (
						<Stack spacing={2.5}>
							<Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
								<TextField
									size="small"
									label="Backend name"
									fullWidth
									value={selectedBackend.name}
									onChange={(event) => {
										const nextName = event.target.value;
										updateSnapshot((draft) => renameBackendReferences(draft, selectedBackend.name, nextName));
										setSelection({ section: "backend", frontendName: shouldFilterBackendPanel ? frontendContext?.name : null, backendName: nextName });
									}}
								/>
								<TextField
									size="small"
									select
									label="Mode"
									fullWidth
									value={selectedBackend.mode ?? ""}
									onChange={(event) =>
										updateSnapshot((draft) => {
											const backend = draft.backends.find((item) => item.name === selectedBackend.name);
											if (backend) backend.mode = event.target.value || null;
										})
									}
									helperText={!selectedBackend.mode && defaultMode ? `Inherited from defaults: ${defaultMode}` : undefined}
								>
									<MenuItem value="">
										<Typography variant="body2" color="text.secondary">
											{defaultMode ? `Use default (${defaultMode})` : "Not set"}
										</Typography>
									</MenuItem>
									<MenuItem value="http">HTTP</MenuItem>
									<MenuItem value="tcp">TCP</MenuItem>
								</TextField>
								<TextField
									size="small"
									select
									label="Balance"
									fullWidth
									data-testid="backend-balance"
									value={selectedBackend.balance ?? ""}
									onChange={(event) =>
										updateSnapshot((draft) => {
											const backend = draft.backends.find((item) => item.name === selectedBackend.name);
											if (backend) backend.balance = event.target.value || null;
										})
									}
								>
									<MenuItem value="">
										<Typography variant="body2" color="text.secondary">
											Not set
										</Typography>
									</MenuItem>
									{BALANCE_ALGORITHM_OPTIONS.map((option) => (
										<MenuItem key={option.value} value={option.value}>
											<Stack>
												<Typography variant="body2">{option.label}</Typography>
												<Typography variant="caption" color="text.secondary">
													{option.description}
												</Typography>
											</Stack>
										</MenuItem>
									))}
								</TextField>
								<TextField
									size="small"
									select
									label="Health check"
									fullWidth
									value={selectedBackend.advCheck ?? ""}
									onChange={(event) =>
										updateSnapshot((draft) => {
											const backend = draft.backends.find((item) => item.name === selectedBackend.name);
											if (backend) backend.advCheck = event.target.value || null;
										})
									}
								>
									{BACKEND_HEALTH_CHECK_OPTIONS.map((option) => (
										<MenuItem key={option.label} value={option.value}>
											{option.label}
										</MenuItem>
									))}
								</TextField>
							</Stack>

							<Stack spacing={1.25}>
								<SectionHeader title="Default server parameters" />
								<Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
									<TextField
										size="small"
										select
										label="TLS to servers"
										fullWidth
										data-testid="default-server-ssl"
										value={selectedBackend.defaultServer?.ssl ?? ""}
										helperText="Applies to every server of this backend unless overridden"
										onChange={(event) => updateDefaultServer(selectedBackend.name, { ssl: event.target.value || null })}
									>
										{SERVER_SSL_OPTIONS.map((option) => (
											<MenuItem key={option.label} value={option.value}>
												{option.label}
											</MenuItem>
										))}
									</TextField>
									<TextField
										size="small"
										select
										label="Certificate verification"
										fullWidth
										data-testid="default-server-verify"
										value={selectedBackend.defaultServer?.verify ?? ""}
										helperText="None accepts self-signed certificates"
										onChange={(event) => updateDefaultServer(selectedBackend.name, { verify: event.target.value || null })}
									>
										{SERVER_VERIFY_OPTIONS.map((option) => (
											<MenuItem key={option.label} value={option.value}>
												{option.label}
											</MenuItem>
										))}
									</TextField>
								</Stack>
								<AdvancedOptionsEditor
									section="default-server"
									testId="advanced-default-server"
									label="default-server"
									extra={selectedBackend.defaultServer?.extra ?? null}
									fields={defaultServerFields}
									onChange={(extra) => updateDefaultServer(selectedBackend.name, { extra })}
								/>
							</Stack>

							<AdvancedOptionsEditor
								section="backend"
								testId="advanced-backend"
								label={selectedBackend.name}
								extra={selectedBackend.extra}
								fields={backendFields}
								onChange={(extra) =>
									updateSnapshot((draft) => {
										const backend = draft.backends.find((item) => item.name === selectedBackend.name);
										if (backend) backend.extra = extra;
									})
								}
							/>

							{selectedRuntimeBackend ? (
								<Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
									<Chip size="small" label={`Status ${selectedRuntimeBackend.status}`} color={selectedRuntimeBackend.downServers > 0 ? "warning" : "success"} />
									<Chip size="small" label={`Sessions ${selectedRuntimeBackend.currentSessions}`} />
									<Chip size="small" label={`Rate ${selectedRuntimeBackend.sessionRate}`} />
									<Chip size="small" label={`${selectedRuntimeBackend.healthyServers} healthy`} color="success" />
								</Stack>
							) : null}

							<ConfigPreview config={buildBackendPreview(selectedBackend, snapshot)} />

							<Divider />

							<SectionHeader
								title="Server Pool"
								action={
									<Button
										size="small"
										startIcon={<Add fontSize="small" />}
										onClick={() =>
											updateSnapshot((draft) => {
												const backend = draft.backends.find((item) => item.name === selectedBackend.name);
												backend?.servers.push(
													createServer(
														createServerName(selectedBackend.name, backend?.servers.length ?? 0),
														selectedBackend.mode === "tcp" ? 6443 : 8080,
													),
												);
											})
										}
									>
										Add server
									</Button>
								}
							/>
							<Stack spacing={1.25}>
								{selectedBackend.servers.map((server, index) => {
									const runtimeServer = selectedRuntimeBackend?.servers.find((item) => item.name === server.name);
									return (
										<Paper
											key={`${server.name}-${index}`}
											variant="outlined"
											sx={{
												p: 1.5,
												borderRadius: 2.5,
												backgroundColor: alpha(theme.palette.background.default, 0.24),
											}}
										>
											<Stack spacing={1.25}>
												<Stack direction="row" alignItems="center" justifyContent="space-between">
													<Stack direction="row" spacing={1} alignItems="center">
														<Typography variant="body2" fontWeight={600}>
															{server.name || `Server ${index + 1}`}
														</Typography>
														<Chip
															size="small"
															label={runtimeServer?.status ?? "unknown"}
															color={runtimeServer?.status === "down" ? "error" : runtimeServer?.status === "maintenance" ? "warning" : "success"}
														/>
														<Chip size="small" variant="outlined" label={server.check === "enabled" ? "check on" : "check off"} />
													</Stack>
													<Button
														size="small"
														color="error"
														variant="text"
														onClick={() =>
															updateSnapshot((draft) => {
																const backend = draft.backends.find((item) => item.name === selectedBackend.name);
																if (!backend) {
																	return;
																}

																backend.servers.splice(index, 1);
															})
														}
													>
														Remove
													</Button>
												</Stack>
												<Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
													<TextField
														size="small"
														label="Server name"
														fullWidth
														value={server.name}
														onChange={(event) =>
															updateSnapshot((draft) => {
																const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
																if (item) item.name = event.target.value;
															})
														}
													/>
													<TextField
														size="small"
														label="Address"
														fullWidth
														value={server.address ?? ""}
														onChange={(event) =>
															updateSnapshot((draft) => {
																const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
																if (item) item.address = event.target.value || null;
															})
														}
													/>
													<TextField
														size="small"
														label="Port"
														type="number"
														fullWidth
														value={server.port ?? ""}
														onChange={(event) =>
															updateSnapshot((draft) => {
																const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
																if (item) item.port = event.target.value === "" ? null : Number(event.target.value);
															})
														}
													/>
													<TextField
														size="small"
														select
														label="Server check"
														fullWidth
														value={server.check ?? "disabled"}
														onChange={(event) =>
															updateSnapshot((draft) => {
																const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
																if (item) item.check = event.target.value || null;
															})
														}
													>
														{SERVER_CHECK_OPTIONS.map((option) => (
															<MenuItem key={option.value} value={option.value}>
																{option.label}
															</MenuItem>
														))}
													</TextField>
												</Stack>
												<Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
													<TextField
														size="small"
														select
														label="TLS"
														fullWidth
														data-testid={`server-ssl-${index}`}
														value={server.ssl ?? ""}
														onChange={(event) =>
															updateSnapshot((draft) => {
																const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
																if (item) item.ssl = event.target.value || null;
															})
														}
													>
														{SERVER_SSL_OPTIONS.map((option) => (
															<MenuItem key={option.label} value={option.value}>
																{option.label}
															</MenuItem>
														))}
													</TextField>
													<TextField
														size="small"
														select
														label="Verify"
														fullWidth
														data-testid={`server-verify-${index}`}
														value={server.verify ?? ""}
														onChange={(event) =>
															updateSnapshot((draft) => {
																const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
																if (item) item.verify = event.target.value || null;
															})
														}
													>
														{SERVER_VERIFY_OPTIONS.map((option) => (
															<MenuItem key={option.label} value={option.value}>
																{option.label}
															</MenuItem>
														))}
													</TextField>
												</Stack>
												<AdvancedOptionsEditor
													section="server"
													testId={`advanced-server-${index}`}
													label={server.name || `Server ${index + 1}`}
													extra={server.extra}
													fields={serverFields}
													onChange={(extra) =>
														updateSnapshot((draft) => {
															const item = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[index];
															if (item) item.extra = extra;
														})
													}
												/>
											</Stack>
										</Paper>
									);
								})}
							</Stack>
						</Stack>
					) : (
						<Typography color="text.secondary">
							{shouldFilterBackendPanel && frontendContext
								? `No backend is linked from ${frontendContext.name}. Use Mapping to create the first link.`
								: "No backend selected."}
						</Typography>
					)}
				</Box>
			</Box>
		</Panel>
	);
}
