import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { Add, ArrowBack, Close, DeleteOutline, DnsOutlined, KeyboardCommandKey, SettingsOutlined, TuneOutlined } from "@mui/icons-material";
import {
	Autocomplete,
	Box,
	Button,
	Chip,
	Divider,
	Drawer,
	IconButton,
	MenuItem,
	Paper,
	Stack,
	Table,
	TableBody,
	TableCell,
	TableContainer,
	TableHead,
	TableRow,
	TextField,
	Tooltip,
	Typography,
	type ChipProps,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { toast } from "react-toastify";
import type {
	HaproxyBackendResource,
	HaproxyDefaultServerResource,
	HaproxyExtra,
	HaproxyFrontendResource,
	HaproxyResourceSnapshot,
	HaproxyServerResource,
} from "@modules/config/config.types";
import type { DashboardSelection, RuntimeBackendStatus, RuntimeServerStatus } from "@modules/dashboard/dashboard.types";
import { parseExtra } from "@modules/config/config.utils";
import { ConfigPreview } from "./ManagementWorkspace.shared";
import { AdvancedOptionsEditor, useSchemaFields } from "./AdvancedOptionsEditor";
import { createBackendDraft, createServer, findBackendReferences, renameBackend, validateBackendResources } from "./backend-management.utils";
import { ConfigToolbar } from "@components/shared/ConfigToolbar";
import { useConfigurationDraft } from "@/view/context/configuration-draft.context";
import { useWorkspaceNavigation } from "@/view/context/workspace-navigation.context";

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

const DRAWER_MIN_WIDTH = 300;
const DRAWER_MAX_WIDTH = 520;
const DRAWER_INITIAL_WIDTH = 360;

function getDefaultMode(snapshot: HaproxyResourceSnapshot): string | null {
	return snapshot.defaults[0]?.mode ?? null;
}

function resolveBackendMode(backend: HaproxyBackendResource, snapshot: HaproxyResourceSnapshot): string | null {
	return backend.mode ?? getDefaultMode(snapshot);
}

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
	if (line === "") return null;
	return nested > 0 ? `    default-server ${line} # +${nested} nested` : `    default-server ${line}`;
}

export function buildBackendPreview(backend: HaproxyBackendResource, snapshot: HaproxyResourceSnapshot): string {
	const lines = [`backend ${backend.name || "backend_name"}`];
	const effectiveMode = resolveBackendMode(backend, snapshot);
	if (effectiveMode) lines.push(`    mode ${effectiveMode}`);
	if (backend.balance) lines.push(`    balance ${backend.balance}`);
	if (backend.advCheck) lines.push(`    option ${backend.advCheck}`);

	for (const [name, value] of Object.entries(parseExtra(backend.extra)).sort(([left], [right]) => left.localeCompare(right))) {
		lines.push(typeof value === "object" && value !== null ? `    # ${name} (nested value)` : `    ${name.replaceAll("_", "-")} ${String(value)}`);
	}

	const defaultServerLine = backend.defaultServer ? buildDefaultServerPreview(backend.defaultServer) : null;
	if (defaultServerLine) lines.push(defaultServerLine);
	if (backend.servers.length === 0) lines.push("    # add at least one server");
	for (const server of backend.servers) lines.push(buildServerPreview(server));
	return lines.join("\n");
}

function runtimeTone(status: string | undefined): ChipProps["color"] {
	if (status === "down") return "error";
	if (status === "maintenance") return "warning";
	if (status === "up") return "success";
	return "default";
}

function runtimeDotColor(status: string | undefined): string {
	if (status === "down") return "error.main";
	if (status === "maintenance") return "warning.main";
	if (status === "up") return "success.main";
	return "text.disabled";
}

function ParameterLabel({ children }: Readonly<{ children: string }>) {
	return (
		<Typography variant="caption" color="text.disabled" sx={{ fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
			{children}
		</Typography>
	);
}

function ParameterPill({ name, value, unset = false }: Readonly<{ name: string; value: string; unset?: boolean }>) {
	return (
		<Box
			sx={(theme) => ({
				display: "inline-flex",
				alignItems: "center",
				gap: 0.75,
				minHeight: 28,
				px: 1.25,
				borderRadius: 2,
				border: `1px ${unset ? "dashed" : "solid"} ${alpha(theme.palette.text.primary, unset ? 0.22 : 0.14)}`,
				backgroundColor: alpha(theme.palette.background.paper, unset ? 0.54 : 0.9),
				fontFamily: "'IBM Plex Mono', 'Cascadia Code', Consolas, monospace",
				fontSize: 12.5,
				color: unset ? "text.disabled" : "text.primary",
				whiteSpace: "nowrap",
			})}
		>
			<Box component="span" sx={{ color: unset ? "inherit" : "info.main" }}>
				{name}
			</Box>
			{value}
		</Box>
	);
}

function DrawerSectionLabel({ children }: Readonly<{ children: string }>) {
	return <ParameterLabel>{children}</ParameterLabel>;
}

function getServerName(backend: HaproxyBackendResource): string {
	const names = new Set(backend.servers.map((server) => server.name));
	let index = 1;
	while (names.has(`${backend.name}_srv_${index}`)) index += 1;
	return `${backend.name}_srv_${index}`;
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
	const isDesktop = useMediaQuery(theme.breakpoints.up("md"), { noSsr: true });
	const { hasUnsavedChanges, discardSnapshotChanges } = useConfigurationDraft();
	const { selection } = useWorkspaceNavigation();
	const backendFields = useSchemaFields("backend");
	const serverFields = useSchemaFields("server");
	const defaultServerFields = useSchemaFields("default-server");
	const selectorInputRef = useRef<HTMLInputElement>(null);
	const backendNameInputRef = useRef<HTMLInputElement>(null);
	const focusBackendNameRef = useRef(false);
	const previousDesktopRef = useRef(isDesktop);
	const [selectorOpen, setSelectorOpen] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(isDesktop);
	const [drawerWidth, setDrawerWidth] = useState(DRAWER_INITIAL_WIDTH);
	const [backendNameDraft, setBackendNameDraft] = useState(selectedBackend?.name ?? "");

	const backendIndex = selectedBackend ? snapshot.backends.indexOf(selectedBackend) : -1;
	const selectedServerIndex = selectedBackend?.servers.findIndex((server) => server.name === selection.serverName) ?? -1;
	const selectedServer = selectedServerIndex >= 0 ? (selectedBackend?.servers[selectedServerIndex] ?? null) : null;
	const validationErrors = useMemo(() => validateBackendResources(snapshot), [snapshot]);
	const validationErrorCount = Object.keys(validationErrors).length;
	const backendNameDraftError = useMemo(() => {
		const name = backendNameDraft.trim();
		if (!selectedBackend || name === selectedBackend.name) return null;
		if (name === "") return "Backend name is required.";
		return snapshot.backends.some((backend) => backend !== selectedBackend && backend.name === name) ? "Backend names must be unique." : null;
	}, [backendNameDraft, selectedBackend, snapshot.backends]);
	const hasLocalErrors = validationErrorCount > 0 || Boolean(backendNameDraftError);
	const backendExtras = useMemo(
		() => Object.entries(parseExtra(selectedBackend?.extra ?? null)).filter(([, value]) => typeof value !== "object" || value === null),
		[selectedBackend?.extra],
	);

	useEffect(() => {
		setBackendNameDraft(selectedBackend?.name ?? "");
	}, [selectedBackend?.name]);

	useEffect(() => {
		if (previousDesktopRef.current === isDesktop) return;
		previousDesktopRef.current = isDesktop;
		setDrawerOpen(isDesktop);
	}, [isDesktop]);

	useEffect(() => {
		if (!focusBackendNameRef.current || !drawerOpen || !selectedBackend) return;
		focusBackendNameRef.current = false;
		window.requestAnimationFrame(() => backendNameInputRef.current?.focus());
	}, [drawerOpen, selectedBackend]);

	useEffect(() => {
		if (!selection.serverName || selectedServer || !selectedBackend) return;
		setSelection({
			section: "backend",
			frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
			backendName: selectedBackend.name,
		});
	}, [frontendContext?.name, selectedBackend, selectedServer, selection.serverName, setSelection, shouldFilterBackendPanel]);

	useEffect(() => {
		const openBackendSelector = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "k") return;
			event.preventDefault();
			setSelectorOpen(true);
			window.requestAnimationFrame(() => selectorInputRef.current?.focus());
		};

		window.addEventListener("keydown", openBackendSelector);
		return () => window.removeEventListener("keydown", openBackendSelector);
	}, []);

	const selectBackend = useCallback(
		(backend: HaproxyBackendResource) => {
			setSelection({
				section: "backend",
				frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
				backendName: backend.name,
			});
			setSelectorOpen(false);
		},
		[frontendContext?.name, setSelection, shouldFilterBackendPanel],
	);

	const updateDefaultServer = (patch: Partial<HaproxyDefaultServerResource>) => {
		if (!selectedBackend) return;
		updateSnapshot((draft) => {
			const backend = draft.backends.find((item) => item.name === selectedBackend.name);
			if (!backend) return;
			const next = { ssl: null, verify: null, extra: null, ...backend.defaultServer, ...patch };
			backend.defaultServer = next.ssl === null && next.verify === null && next.extra === null ? null : next;
		});
	};

	const updateBackend = (patch: Partial<HaproxyBackendResource>) => {
		if (!selectedBackend) return;
		updateSnapshot((draft) => {
			const backend = draft.backends.find((item) => item.name === selectedBackend.name);
			if (backend) Object.assign(backend, patch);
		});
	};

	const updateServer = (serverIndex: number, patch: Partial<HaproxyServerResource>) => {
		if (!selectedBackend) return;
		const currentServerName = selectedBackend.servers[serverIndex]?.name;
		updateSnapshot((draft) => {
			const server = draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers[serverIndex];
			if (server) Object.assign(server, patch);
		});

		if (patch.name !== undefined && selection.serverName === currentServerName) {
			setSelection({
				section: "backend",
				frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
				backendName: selectedBackend.name,
				serverName: patch.name,
			});
		}
	};

	const commitBackendName = () => {
		if (!selectedBackend || backendNameDraftError) return;
		const nextName = backendNameDraft.trim();
		if (nextName === selectedBackend.name) return;
		const currentName = selectedBackend.name;
		updateSnapshot((draft) => renameBackend(draft, currentName, nextName));
		setSelection({
			section: "backend",
			frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
			backendName: nextName,
		});
	};

	const handleBackendNameKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		if (event.key !== "Enter") return;
		event.preventDefault();
		commitBackendName();
		event.currentTarget.blur();
	};

	const createBackend = () => {
		const backend = createBackendDraft(snapshot);
		updateSnapshot((draft) => void draft.backends.push(backend));
		setSelection({ section: "backend", backendName: backend.name, frontendName: shouldFilterBackendPanel ? frontendContext?.name : null });
		focusBackendNameRef.current = true;
		setDrawerOpen(true);
	};

	const deleteBackend = () => {
		if (!selectedBackend) return;
		const references = findBackendReferences(snapshot, selectedBackend.name);
		if (references.length > 0) {
			const owners = references.map((reference) => `${reference.frontendName} (${reference.source})`).join(", ");
			toast.error(`Cannot delete ${selectedBackend.name}. Remove these frontend references first: ${owners}`);
			return;
		}

		updateSnapshot((draft) => {
			draft.backends = draft.backends.filter((backend) => backend.name !== selectedBackend.name);
		});
		setSelection({ section: "backend", frontendName: shouldFilterBackendPanel ? frontendContext?.name : null });
		if (snapshot.backends.length <= 1) setDrawerOpen(false);
	};

	const addServer = () => {
		if (!selectedBackend) return;
		const server = createServer(getServerName(selectedBackend), selectedBackend.mode === "tcp" ? 6443 : 8080);
		updateSnapshot((draft) => {
			draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers.push(server);
		});
	};

	const removeServer = (serverIndex: number) => {
		if (!selectedBackend) return;
		const removedName = selectedBackend.servers[serverIndex]?.name;
		updateSnapshot((draft) => {
			draft.backends.find((backend) => backend.name === selectedBackend.name)?.servers.splice(serverIndex, 1);
		});
		if (selection.serverName === removedName) {
			setSelection({
				section: "backend",
				frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
				backendName: selectedBackend.name,
			});
		}
	};

	const showBackendDrawer = () => {
		if (!selectedBackend) return;
		setSelection({
			section: "backend",
			frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
			backendName: selectedBackend.name,
		});
		setDrawerOpen(true);
	};

	const showServerDrawer = (server: HaproxyServerResource) => {
		if (!selectedBackend) return;
		setSelection({
			section: "backend",
			frontendName: shouldFilterBackendPanel ? frontendContext?.name : null,
			backendName: selectedBackend.name,
			serverName: server.name,
		});
		setDrawerOpen(true);
	};

	const closeDrawer = () => setDrawerOpen(false);

	const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
		const startX = event.clientX;
		const startWidth = drawerWidth;
		const resize = (pointerEvent: PointerEvent) => {
			setDrawerWidth(Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, startWidth + startX - pointerEvent.clientX)));
		};
		const stop = () => {
			window.removeEventListener("pointermove", resize);
			window.removeEventListener("pointerup", stop);
		};
		window.addEventListener("pointermove", resize);
		window.addEventListener("pointerup", stop);
	};

	const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		const delta = event.key === "ArrowLeft" ? 16 : -16;
		setDrawerWidth((current) => Math.min(DRAWER_MAX_WIDTH, Math.max(DRAWER_MIN_WIDTH, current + delta)));
	};

	const tableFieldSx = {
		minWidth: 112,
		"& .MuiInputBase-root": {
			fontSize: 13,
			borderRadius: 1.25,
			transition: theme.transitions.create("background-color"),
			"&:hover, &.Mui-focused": { backgroundColor: alpha(theme.palette.primary.main, 0.06) },
		},
		"& .MuiFormHelperText-root": { mx: 0, fontSize: 10, lineHeight: 1.1 },
	} as const;

	const drawerContent = selectedBackend ? (
		<Box sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column", backgroundColor: alpha(theme.palette.background.default, 0.48) }}>
			<Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ px: 2, py: 1.5 }}>
				<Stack direction="row" alignItems="center" spacing={1} minWidth={0}>
					{selectedServer ? (
						<Tooltip title="Back to backend settings" arrow>
							<IconButton size="small" onClick={showBackendDrawer} aria-label="Back to backend settings">
								<ArrowBack fontSize="small" />
							</IconButton>
						</Tooltip>
					) : null}
					<Box minWidth={0}>
						<Typography variant="subtitle1" fontWeight={700} noWrap>
							{selectedServer ? "Server settings" : "Backend settings"}
						</Typography>
						{selectedServer ? (
							<Typography variant="caption" color="text.secondary" noWrap display="block">
								{selectedServer.name}
							</Typography>
						) : null}
					</Box>
				</Stack>
				<IconButton size="small" onClick={closeDrawer} aria-label="Close settings">
					<Close fontSize="small" />
				</IconButton>
			</Stack>

			<Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2, pb: 2 }}>
				{selectedServer ? (
					<Stack spacing={1.5}>
						<DrawerSectionLabel>Server</DrawerSectionLabel>
						<TextField
							size="small"
							label="Server name"
							fullWidth
							value={selectedServer.name}
							error={Boolean(validationErrors[`backends[${backendIndex}].servers[${selectedServerIndex}].name`])}
							helperText={validationErrors[`backends[${backendIndex}].servers[${selectedServerIndex}].name`]}
							onChange={(event) => updateServer(selectedServerIndex, { name: event.target.value })}
						/>
						<TextField
							size="small"
							label="Address"
							fullWidth
							value={selectedServer.address ?? ""}
							error={Boolean(validationErrors[`backends[${backendIndex}].servers[${selectedServerIndex}].address`])}
							helperText={validationErrors[`backends[${backendIndex}].servers[${selectedServerIndex}].address`]}
							onChange={(event) => updateServer(selectedServerIndex, { address: event.target.value || null })}
						/>
						<TextField
							size="small"
							label="Port"
							type="number"
							fullWidth
							value={selectedServer.port ?? ""}
							error={Boolean(validationErrors[`backends[${backendIndex}].servers[${selectedServerIndex}].port`])}
							helperText={validationErrors[`backends[${backendIndex}].servers[${selectedServerIndex}].port`]}
							onChange={(event) => updateServer(selectedServerIndex, { port: event.target.value === "" ? null : Number(event.target.value) })}
						/>
						<TextField
							size="small"
							select
							label="Server check"
							fullWidth
							value={selectedServer.check ?? "disabled"}
							onChange={(event) => updateServer(selectedServerIndex, { check: event.target.value || null })}
						>
							{SERVER_CHECK_OPTIONS.map((option) => (
								<MenuItem key={option.value} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>
						<TextField
							size="small"
							select
							label="TLS"
							fullWidth
							data-testid={`server-drawer-ssl-${selectedServerIndex}`}
							value={selectedServer.ssl ?? ""}
							onChange={(event) => updateServer(selectedServerIndex, { ssl: event.target.value || null })}
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
							data-testid={`server-drawer-verify-${selectedServerIndex}`}
							value={selectedServer.verify ?? ""}
							onChange={(event) => updateServer(selectedServerIndex, { verify: event.target.value || null })}
						>
							{SERVER_VERIFY_OPTIONS.map((option) => (
								<MenuItem key={option.label} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>
						<AdvancedOptionsEditor
							section="server"
							testId={`advanced-server-${selectedServerIndex}`}
							label={selectedServer.name || `Server ${selectedServerIndex + 1}`}
							extra={selectedServer.extra}
							fields={serverFields}
							inline
							onChange={(extra) => updateServer(selectedServerIndex, { extra })}
						/>
					</Stack>
				) : (
					<Stack spacing={1.5}>
						<DrawerSectionLabel>Backend</DrawerSectionLabel>
						<TextField
							inputRef={backendNameInputRef}
							size="small"
							label="Backend name"
							fullWidth
							value={backendNameDraft}
							error={Boolean(backendNameDraftError ?? validationErrors[`backends[${backendIndex}].name`])}
							helperText={backendNameDraftError ?? validationErrors[`backends[${backendIndex}].name`] ?? "Applied on blur or Enter"}
							onChange={(event) => setBackendNameDraft(event.target.value)}
							onBlur={commitBackendName}
							onKeyDown={handleBackendNameKeyDown}
						/>
						<TextField
							size="small"
							select
							label="Mode"
							fullWidth
							value={selectedBackend.mode ?? ""}
							onChange={(event) => updateBackend({ mode: event.target.value || null })}
						>
							<MenuItem value="">{getDefaultMode(snapshot) ? `Use default (${getDefaultMode(snapshot)})` : "Not set"}</MenuItem>
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
							onChange={(event) => updateBackend({ balance: event.target.value || null })}
						>
							<MenuItem value="">Not set</MenuItem>
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
							onChange={(event) => updateBackend({ advCheck: event.target.value || null })}
						>
							{BACKEND_HEALTH_CHECK_OPTIONS.map((option) => (
								<MenuItem key={option.label} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>

						<Box sx={{ pt: 0.5 }}>
							<DrawerSectionLabel>Default server</DrawerSectionLabel>
						</Box>
						<TextField
							size="small"
							select
							label="TLS to servers"
							fullWidth
							data-testid="default-server-ssl"
							value={selectedBackend.defaultServer?.ssl ?? ""}
							onChange={(event) => updateDefaultServer({ ssl: event.target.value || null })}
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
							onChange={(event) => updateDefaultServer({ verify: event.target.value || null })}
						>
							{SERVER_VERIFY_OPTIONS.map((option) => (
								<MenuItem key={option.label} value={option.value}>
									{option.label}
								</MenuItem>
							))}
						</TextField>
						<AdvancedOptionsEditor
							section="default-server"
							testId="advanced-default-server"
							label="default-server"
							extra={selectedBackend.defaultServer?.extra ?? null}
							fields={defaultServerFields}
							onChange={(extra) => updateDefaultServer({ extra })}
						/>

						<Box sx={{ pt: 0.5 }}>
							<DrawerSectionLabel>Advanced</DrawerSectionLabel>
						</Box>
						<AdvancedOptionsEditor
							section="backend"
							testId="advanced-backend"
							label={selectedBackend.name}
							extra={selectedBackend.extra}
							fields={backendFields}
							inline
							onChange={(extra) => updateBackend({ extra })}
						/>
					</Stack>
				)}
			</Box>

			<Box sx={{ borderTop: `1px solid ${theme.palette.divider}` }}>
				<ConfigPreview config={buildBackendPreview(selectedBackend, snapshot)} collapsible defaultExpanded />
			</Box>
		</Box>
	) : null;

	return (
		<Paper
			sx={{
				height: "100%",
				minHeight: 0,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				borderColor: focused ? alpha(theme.palette.primary.main, 0.42) : theme.palette.divider,
				boxShadow: focused
					? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 24px 48px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.24 : 0.08)}`
					: undefined,
			}}
		>
			<Stack
				direction={{ xs: "column", md: "row" }}
				alignItems={{ xs: "stretch", md: "center" }}
				justifyContent="space-between"
				spacing={1.5}
				sx={{
					px: 2,
					py: 1.25,
					borderBottom: `1px solid ${alpha(theme.palette.primary.main, focused ? 0.28 : 0.12)}`,
					background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.background.paper, 0.92)})`,
				}}
			>
				<Stack direction="row" alignItems="center" spacing={1.25} minWidth={0} flexWrap="wrap" useFlexGap>
					<Box
						sx={{
							width: 32,
							height: 32,
							borderRadius: "50%",
							display: "grid",
							placeItems: "center",
							color: "primary.main",
							backgroundColor: alpha(theme.palette.primary.main, 0.16),
						}}
					>
						<DnsOutlined fontSize="small" />
					</Box>
					<Typography variant="h6" sx={{ fontSize: 17 }}>
						Backend
					</Typography>
					<Autocomplete
						key={selectedBackend ? "selected-backend" : "empty-backend"}
						disableClearable
						open={selectorOpen}
						onOpen={() => setSelectorOpen(true)}
						onClose={() => setSelectorOpen(false)}
						options={backendCandidates}
						value={selectedBackend ?? undefined}
						isOptionEqualToValue={(option, value) => option.name === value.name}
						getOptionLabel={(option) => option.name}
						onChange={(_event, backend) => {
							if (backend) selectBackend(backend);
						}}
						sx={{ width: { xs: "100%", sm: 330 }, minWidth: 180 }}
						renderOption={(props, backend) => {
							const runtime = runtimeBackends.find((item) => item.name === backend.name);
							return (
								<Box component="li" {...props} key={backend.name} data-testid={`backend-item-${backend.name}`}>
									<Stack direction="row" alignItems="center" justifyContent="space-between" width="100%" spacing={2}>
										<Box>
											<Typography variant="body2" fontWeight={700}>
												{backend.name}
											</Typography>
											<Typography variant="caption" color="text.secondary">
												{resolveBackendMode(backend, snapshot) ?? "no mode"} · {backend.servers.length} servers
											</Typography>
										</Box>
										<Chip size="small" label={runtime?.status ?? "unknown"} color={runtimeTone(runtime?.status)} />
									</Stack>
								</Box>
							);
						}}
						renderInput={(params) => (
							<TextField
								{...params}
								inputRef={selectorInputRef}
								inputProps={{ ...params.inputProps, "aria-label": "Select a backend" }}
								size="small"
								placeholder="Select a backend"
								data-testid="backend-selector"
							/>
						)}
					/>
					<Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "text.disabled", display: { xs: "none", xl: "flex" } }}>
						<KeyboardCommandKey sx={{ fontSize: 15 }} />
						<Typography variant="caption">K to switch</Typography>
					</Stack>
					{selectedBackend ? (
						<Chip
							size="small"
							variant="outlined"
							label={`Runtime ${selectedRuntimeBackend?.status ?? "unknown"}`}
							color={runtimeTone(selectedRuntimeBackend?.status)}
						/>
					) : null}
					{shouldFilterBackendPanel && frontendContext ? <Chip size="small" variant="outlined" label={`Linked to ${frontendContext.name}`} /> : null}
				</Stack>

				<Stack direction="row" alignItems="center" spacing={1} justifyContent={{ xs: "flex-end", md: "initial" }}>
					<Button size="small" variant="contained" startIcon={<Add fontSize="small" />} onClick={createBackend}>
						Create
					</Button>
					<Button size="small" color="error" variant="outlined" startIcon={<DeleteOutline fontSize="small" />} disabled={!selectedBackend} onClick={deleteBackend}>
						Delete
					</Button>
					<Divider orientation="vertical" flexItem />
					<ConfigToolbar variant="refresh" />
				</Stack>
			</Stack>

			{selectedBackend ? (
				<Stack
					direction="row"
					alignItems="center"
					spacing={1.25}
					sx={{
						px: 2,
						py: 1.1,
						minHeight: 54,
						overflowX: "auto",
						borderBottom: `1px solid ${theme.palette.divider}`,
						backgroundColor: alpha(theme.palette.background.default, 0.46),
					}}
				>
					<ParameterLabel>Backend</ParameterLabel>
					<ParameterPill name="mode" value={resolveBackendMode(selectedBackend, snapshot) ?? "not set"} unset={!selectedBackend.mode} />
					<ParameterPill name="balance" value={selectedBackend.balance ?? "not set"} unset={!selectedBackend.balance} />
					<ParameterPill name="option" value={selectedBackend.advCheck ?? "not set"} unset={!selectedBackend.advCheck} />
					{backendExtras.map(([name, value]) => (
						<ParameterPill key={name} name={name.replaceAll("_", "-")} value={String(value)} />
					))}
					<Divider orientation="vertical" flexItem />
					<ParameterLabel>Default server</ParameterLabel>
					<ParameterPill name="ssl" value={selectedBackend.defaultServer?.ssl ?? "not set"} unset={!selectedBackend.defaultServer?.ssl} />
					<ParameterPill name="verify" value={selectedBackend.defaultServer?.verify ?? "not set"} unset={!selectedBackend.defaultServer?.verify} />
					<Box sx={{ flex: 1 }} />
					<Button size="small" variant="outlined" startIcon={<TuneOutlined fontSize="small" />} onClick={showBackendDrawer}>
						Modify
					</Button>
					<Chip size="small" label={`Sessions ${selectedRuntimeBackend?.currentSessions ?? 0}`} />
					<Chip size="small" label={`${selectedRuntimeBackend?.downServers ?? 0} down`} color={selectedRuntimeBackend?.downServers ? "warning" : "success"} />
				</Stack>
			) : null}

			<Box sx={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden" }}>
				<Box sx={{ flex: 1, minWidth: 0, overflow: "auto", p: { xs: 1.5, md: 2 } }}>
					{selectedBackend ? (
						<Stack spacing={1.25}>
							<Stack direction="row" alignItems="center" justifyContent="space-between">
								<Stack direction="row" alignItems="center" spacing={1}>
									<Typography variant="subtitle2">Server pool</Typography>
									<Chip size="small" label={selectedBackend.servers.length} />
								</Stack>
								<Button size="small" variant="contained" startIcon={<Add fontSize="small" />} onClick={addServer}>
									Add server
								</Button>
							</Stack>

							<TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2.5, boxShadow: "none", overflow: "auto" }}>
								<Table size="small" stickyHeader sx={{ minWidth: 1050 }} aria-label={`Servers for ${selectedBackend.name}`}>
									<TableHead>
										<TableRow>
											<TableCell width={28} />
											<TableCell>Server name</TableCell>
											<TableCell>Address</TableCell>
											<TableCell>Port</TableCell>
											<TableCell>Server check</TableCell>
											<TableCell>TLS</TableCell>
											<TableCell>Verify</TableCell>
											<TableCell>Runtime</TableCell>
											<TableCell align="right" width={84} />
										</TableRow>
									</TableHead>
									<TableBody>
										{selectedBackend.servers.map((server, serverIndex) => {
											const runtime: RuntimeServerStatus | undefined = selectedRuntimeBackend?.servers.find((item) => item.name === server.name);
											const path = `backends[${backendIndex}].servers[${serverIndex}]`;
											return (
												<TableRow key={`${server.name}-${serverIndex}`} hover data-testid={`server-row-${serverIndex}`}>
													<TableCell>
														<Box
															sx={{
																width: 8,
																height: 8,
																borderRadius: "50%",
																backgroundColor: runtimeDotColor(runtime?.status),
																opacity: runtime ? 1 : 0.35,
															}}
														/>
													</TableCell>
													<TableCell>
														<TextField
															variant="standard"
															value={server.name}
															error={Boolean(validationErrors[`${path}.name`])}
															helperText={validationErrors[`${path}.name`]}
															onChange={(event) => updateServer(serverIndex, { name: event.target.value })}
															inputProps={{ "aria-label": `Server ${serverIndex + 1} name` }}
															sx={{ ...tableFieldSx, minWidth: 170 }}
														/>
													</TableCell>
													<TableCell>
														<TextField
															variant="standard"
															value={server.address ?? ""}
															error={Boolean(validationErrors[`${path}.address`])}
															helperText={validationErrors[`${path}.address`]}
															onChange={(event) => updateServer(serverIndex, { address: event.target.value || null })}
															inputProps={{ "aria-label": `Server ${serverIndex + 1} address` }}
															sx={{ ...tableFieldSx, minWidth: 150 }}
														/>
													</TableCell>
													<TableCell>
														<TextField
															variant="standard"
															type="number"
															value={server.port ?? ""}
															error={Boolean(validationErrors[`${path}.port`])}
															helperText={validationErrors[`${path}.port`]}
															onChange={(event) => updateServer(serverIndex, { port: event.target.value === "" ? null : Number(event.target.value) })}
															inputProps={{ "aria-label": `Server ${serverIndex + 1} port` }}
															sx={{ ...tableFieldSx, minWidth: 82 }}
														/>
													</TableCell>
													<TableCell>
														<TextField
															variant="standard"
															select
															value={server.check ?? "disabled"}
															onChange={(event) => updateServer(serverIndex, { check: event.target.value || null })}
															SelectProps={{ inputProps: { "aria-label": `Server ${serverIndex + 1} check` } }}
															sx={tableFieldSx}
														>
															{SERVER_CHECK_OPTIONS.map((option) => (
																<MenuItem key={option.value} value={option.value}>
																	{option.label}
																</MenuItem>
															))}
														</TextField>
													</TableCell>
													<TableCell>
														<TextField
															variant="standard"
															select
															data-testid={`server-ssl-${serverIndex}`}
															value={server.ssl ?? ""}
															onChange={(event) => updateServer(serverIndex, { ssl: event.target.value || null })}
															SelectProps={{ inputProps: { "aria-label": `Server ${serverIndex + 1} TLS` } }}
															sx={tableFieldSx}
														>
															{SERVER_SSL_OPTIONS.map((option) => (
																<MenuItem key={option.label} value={option.value}>
																	{option.label}
																</MenuItem>
															))}
														</TextField>
													</TableCell>
													<TableCell>
														<TextField
															variant="standard"
															select
															data-testid={`server-verify-${serverIndex}`}
															value={server.verify ?? ""}
															onChange={(event) => updateServer(serverIndex, { verify: event.target.value || null })}
															SelectProps={{ inputProps: { "aria-label": `Server ${serverIndex + 1} verify` } }}
															sx={tableFieldSx}
														>
															{SERVER_VERIFY_OPTIONS.map((option) => (
																<MenuItem key={option.label} value={option.value}>
																	{option.label}
																</MenuItem>
															))}
														</TextField>
													</TableCell>
													<TableCell>
														<Chip size="small" label={runtime?.status ?? "unknown"} color={runtimeTone(runtime?.status)} />
													</TableCell>
													<TableCell align="right">
														<Tooltip title="Server settings" arrow>
															<IconButton
																size="small"
																aria-label={`Settings for ${server.name}`}
																data-testid={`server-settings-${serverIndex}`}
																onClick={() => showServerDrawer(server)}
															>
																<SettingsOutlined fontSize="small" />
															</IconButton>
														</Tooltip>
														<Tooltip title="Delete server" arrow>
															<IconButton size="small" color="error" aria-label={`Delete ${server.name}`} onClick={() => removeServer(serverIndex)}>
																<DeleteOutline fontSize="small" />
															</IconButton>
														</Tooltip>
													</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
								<Box sx={{ px: 2, py: 1.15, borderTop: `1px solid ${theme.palette.divider}`, color: "text.disabled", fontSize: 12.5 }}>
									Edit cells in place · Tab moves to the next field · Settings opens advanced server options.
								</Box>
							</TableContainer>
						</Stack>
					) : (
						<Box sx={{ height: "100%", display: "grid", placeItems: "center", textAlign: "center", px: 3 }}>
							<Stack spacing={1.5} alignItems="center">
								<DnsOutlined color="disabled" sx={{ fontSize: 46 }} />
								<Typography variant="h6">No backend selected</Typography>
								<Typography color="text.secondary">
									{shouldFilterBackendPanel && frontendContext
										? `No backend is linked from ${frontendContext.name}.`
										: "Create a backend to start building a server pool."}
								</Typography>
								<Button variant="contained" startIcon={<Add />} onClick={createBackend}>
									Create backend
								</Button>
							</Stack>
						</Box>
					)}
				</Box>

				{isDesktop && drawerOpen && drawerContent ? (
					<>
						<Box
							role="separator"
							aria-label="Resize settings panel"
							aria-orientation="vertical"
							aria-valuemin={DRAWER_MIN_WIDTH}
							aria-valuemax={DRAWER_MAX_WIDTH}
							aria-valuenow={drawerWidth}
							tabIndex={0}
							onPointerDown={startResize}
							onKeyDown={resizeWithKeyboard}
							sx={{
								width: 7,
								flex: "0 0 7px",
								cursor: "col-resize",
								borderLeft: `1px solid ${theme.palette.divider}`,
								backgroundColor: alpha(theme.palette.text.primary, 0.035),
								position: "relative",
								"&::after": {
									content: '""',
									position: "absolute",
									width: 2,
									height: 34,
									borderRadius: 1,
									backgroundColor: alpha(theme.palette.text.primary, 0.2),
									top: "50%",
									left: "50%",
									transform: "translate(-50%, -50%)",
								},
								"&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 },
							}}
						/>
						<Box component="aside" sx={{ width: drawerWidth, minWidth: DRAWER_MIN_WIDTH, flex: "0 0 auto", minHeight: 0, overflow: "hidden" }}>
							{drawerContent}
						</Box>
					</>
				) : null}
			</Box>

			<Stack
				direction={{ xs: "column", sm: "row" }}
				alignItems={{ xs: "stretch", sm: "center" }}
				justifyContent="space-between"
				spacing={1}
				sx={{ px: 2, py: 1.1, borderTop: `1px solid ${theme.palette.divider}`, backgroundColor: alpha(theme.palette.background.paper, 0.92) }}
			>
				<Stack direction="row" alignItems="center" spacing={1} minWidth={0}>
					<Box sx={{ width: 8, height: 8, borderRadius: "50%", flex: "0 0 auto", backgroundColor: hasUnsavedChanges ? "warning.main" : "success.main" }} />
					<Typography variant="body2" color={hasUnsavedChanges ? "text.primary" : "text.secondary"}>
						{hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
					</Typography>
					<Button size="small" disabled={!hasUnsavedChanges} onClick={discardSnapshotChanges}>
						Cancel changes
					</Button>
					{validationErrorCount > 0 ? (
						<Typography variant="caption" color="error">
							{validationErrorCount} validation {validationErrorCount === 1 ? "error" : "errors"}
						</Typography>
					) : null}
				</Stack>
				<ConfigToolbar variant="commit" commitDisabled={hasLocalErrors} />
			</Stack>

			{!isDesktop ? (
				<Drawer anchor="right" open={drawerOpen && Boolean(drawerContent)} onClose={closeDrawer} slotProps={{ paper: { sx: { width: "100vw", maxWidth: "100vw" } } }}>
					{drawerContent}
				</Drawer>
			) : null}
		</Paper>
	);
}
