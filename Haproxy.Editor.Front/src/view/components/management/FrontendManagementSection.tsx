import { Add, DeleteOutline, LanOutlined } from "@mui/icons-material";
import { Box, Button, Chip, Divider, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { HaproxyFrontendResource, HaproxyResourceSnapshot } from "@modules/config/config.types";
import type { DashboardSelection } from "@modules/dashboard/dashboard.types";
import { parseExtra } from "@modules/config/config.utils";
import { ConfigPreview, Panel, SectionHeader } from "./ManagementWorkspace.shared";
import { AdvancedOptionsEditor, useSchemaFields } from "./AdvancedOptionsEditor";

function buildFrontendPreview(frontend: HaproxyFrontendResource): string {
	const lines = [`frontend ${frontend.name || "frontend_name"}`];

	if (frontend.mode) {
		lines.push(`    mode ${frontend.mode}`);
	}

	for (const [name, value] of Object.entries(parseExtra(frontend.extra)).sort(([left], [right]) => left.localeCompare(right))) {
		lines.push(typeof value === "object" && value !== null ? `    # ${name} (nested value)` : `    ${name.replaceAll("_", "-")} ${String(value)}`);
	}

	for (const bind of frontend.binds) {
		const address = bind.address?.trim() || "*";
		const port = bind.port ?? 80;
		const entries = Object.entries(parseExtra(bind.extra)).sort(([left], [right]) => left.localeCompare(right));
		const scalars = entries.filter(([, value]) => typeof value !== "object" || value === null);
		const args = scalars.map(([name, value]) => `${name.replaceAll("_", "-")} ${String(value)}`).join(" ");
		const nested = entries.length - scalars.length;
		const line = [`    bind ${address}:${port}`, args].filter((part) => part !== "").join(" ");
		lines.push(nested > 0 ? `${line} # +${nested} nested` : line);
	}

	for (const acl of frontend.acls) {
		if (acl.criterion && acl.value) {
			lines.push(`    acl ${acl.name} ${acl.criterion} ${acl.value}`);
		}
	}

	for (const rule of frontend.backendSwitchingRules) {
		const cond = rule.cond && rule.condTest ? ` ${rule.cond} ${rule.condTest}` : "";
		lines.push(`    use_backend ${rule.backendName}${cond}`);
	}

	if (frontend.defaultBackend) {
		lines.push(`    default_backend ${frontend.defaultBackend}`);
	}

	return lines.join("\n");
}

type FrontendManagementSectionProps = {
	snapshot: HaproxyResourceSnapshot;
	frontendContext: HaproxyFrontendResource | null;
	frontendRelatedBackendNames: Set<string>;
	updateSnapshot: (updater: (draft: HaproxyResourceSnapshot) => void) => void;
	setSelection: (nextSelection: DashboardSelection) => void;
	focused: boolean;
};

export function FrontendManagementSection({
	snapshot,
	frontendContext,
	frontendRelatedBackendNames,
	updateSnapshot,
	setSelection,
	focused,
}: Readonly<FrontendManagementSectionProps>) {
	const theme = useTheme();
	const frontendFields = useSchemaFields("frontend");
	const bindFields = useSchemaFields("bind");

	return (
		<Panel
			title="Frontend Management"
			subtitle={`${snapshot.frontends.length} frontends loaded`}
			icon={<LanOutlined fontSize="small" />}
			focused={focused}
			actions={
				<Stack direction="row" spacing={1}>
					<Button
						size="small"
						variant="contained"
						startIcon={<Add fontSize="small" />}
						onClick={() => {
							const frontendName = `frontend_${snapshot.frontends.length + 1}`;
							updateSnapshot((draft) => {
								draft.frontends.push({
									name: frontendName,
									mode: "http",
									defaultBackend: draft.backends[0]?.name ?? null,
									binds: [{ name: `${frontendName}_bind`, address: "0.0.0.0", port: 80, extra: null }],
									acls: [],
									backendSwitchingRules: [],
									extra: null,
								});
							});
							setSelection({ section: "frontend", frontendName });
						}}
					>
						Create
					</Button>
					<Button
						size="small"
						color="error"
						variant="outlined"
						startIcon={<DeleteOutline fontSize="small" />}
						disabled={!frontendContext}
						onClick={() => {
							if (!frontendContext) return;
							updateSnapshot((draft) => {
								draft.frontends = draft.frontends.filter((item) => item.name !== frontendContext.name);
							});
							setSelection({ section: "frontend" });
						}}
					>
						Delete
					</Button>
				</Stack>
			}
		>
			<Box sx={{ height: "100%", minHeight: 0, overflow: "auto", p: 2 }}>
				<Stack spacing={3}>
					<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }} useFlexGap>
						{snapshot.frontends.map((frontend) => {
							const isSelected = frontendContext?.name === frontend.name;
							return (
								<Chip
									key={frontend.name}
									label={`${frontend.name} (${frontend.mode ?? "tcp"}, ${frontend.binds.length} bind${frontend.binds.length !== 1 ? "s" : ""})`}
									variant={isSelected ? "filled" : "outlined"}
									color={isSelected ? "primary" : "default"}
									onClick={() => setSelection({ section: "frontend", frontendName: frontend.name })}
									sx={{
										borderRadius: 2,
										transition: theme.transitions.create(["background-color", "border-color", "box-shadow"]),
										...(isSelected && {
											boxShadow: `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}`,
										}),
									}}
								/>
							);
						})}
					</Stack>

					{frontendContext ? (
						<Stack spacing={2.5}>
							<Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
								<TextField
									size="small"
									label="Name"
									fullWidth
									value={frontendContext.name}
									onChange={(event) => {
										const nextName = event.target.value;
										updateSnapshot((draft) => {
											const frontend = draft.frontends.find((item) => item.name === frontendContext.name);
											if (frontend) {
												frontend.name = nextName;
											}
										});
										setSelection({ section: "frontend", frontendName: nextName });
									}}
								/>
								<TextField
									size="small"
									select
									label="Mode"
									sx={{ minWidth: 140 }}
									value={frontendContext.mode ?? ""}
									onChange={(event) =>
										updateSnapshot((draft) => {
											const frontend = draft.frontends.find((item) => item.name === frontendContext.name);
											if (frontend) frontend.mode = event.target.value || null;
										})
									}
								>
									<MenuItem value="http">HTTP</MenuItem>
									<MenuItem value="tcp">TCP</MenuItem>
								</TextField>
							</Stack>

							<AdvancedOptionsEditor
								section="frontend"
								testId="advanced-frontend"
								label={frontendContext.name}
								extra={frontendContext.extra}
								fields={frontendFields}
								onChange={(extra) =>
									updateSnapshot((draft) => {
										const frontend = draft.frontends.find((item) => item.name === frontendContext.name);
										if (frontend) frontend.extra = extra;
									})
								}
							/>

							<ConfigPreview config={buildFrontendPreview(frontendContext)} />

							<Divider />
							<Box>
								<Typography variant="subtitle2" sx={{ mb: 1.5 }}>
									Links
								</Typography>
								<Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }} useFlexGap>
									<Tooltip title={`${frontendContext.acls.length} ACLs attached to this frontend`} arrow>
										<Chip
											label={`ACLs (${frontendContext.acls.length})`}
											variant="outlined"
											clickable
											onClick={() => setSelection({ section: "acl", frontendName: frontendContext.name })}
											sx={{
												borderColor: alpha(theme.palette.primary.main, 0.28),
												"&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
											}}
										/>
									</Tooltip>
									<Tooltip title={`${frontendContext.backendSwitchingRules.length} routing rules and ${frontendRelatedBackendNames.size} linked backends`} arrow>
										<Chip
											label={`Mapping (${frontendContext.backendSwitchingRules.length} rules)`}
											variant="outlined"
											clickable
											onClick={() => setSelection({ section: "mapping", frontendName: frontendContext.name })}
											sx={{
												borderColor: alpha(theme.palette.primary.main, 0.28),
												"&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
											}}
										/>
									</Tooltip>
									<Tooltip title="Only related backends are shown when you navigate from this frontend" arrow>
										<Chip
											label={`Backends (${frontendRelatedBackendNames.size})`}
											variant="outlined"
											clickable
											onClick={() => setSelection({ section: "backend", frontendName: frontendContext.name })}
											sx={{
												borderColor: alpha(theme.palette.primary.main, 0.28),
												"&:hover": { backgroundColor: alpha(theme.palette.primary.main, 0.08) },
											}}
										/>
									</Tooltip>
								</Stack>
							</Box>

							<Divider />
							<SectionHeader
								title="Bind Interfaces"
								action={
									<Button
										size="small"
										startIcon={<Add fontSize="small" />}
										onClick={() =>
											updateSnapshot((draft) => {
												const frontend = draft.frontends.find((item) => item.name === frontendContext.name);
												frontend?.binds.push({
													name: `${frontendContext.name}_bind_${(frontend?.binds.length ?? 0) + 1}`,
													address: "0.0.0.0",
													port: 80,
													extra: null,
												});
											})
										}
									>
										Add bind
									</Button>
								}
							/>
							<Stack spacing={0} divider={<Divider sx={{ opacity: 0.4 }} />}>
								{frontendContext.binds.map((bind, index) => (
									<Stack key={bind.name || index} spacing={1.25} sx={{ py: 1.5 }}>
										<Stack direction={{ xs: "column", md: "row" }} spacing={1.25}>
											<TextField
												size="small"
												label="Address"
												fullWidth
												value={bind.address ?? ""}
												onChange={(event) =>
													updateSnapshot((draft) => {
														const item = draft.frontends.find((frontend) => frontend.name === frontendContext.name)?.binds[index];
														if (item) item.address = event.target.value || null;
													})
												}
											/>
											<TextField
												size="small"
												label="Port"
												type="number"
												value={bind.port ?? ""}
												onChange={(event) =>
													updateSnapshot((draft) => {
														const item = draft.frontends.find((frontend) => frontend.name === frontendContext.name)?.binds[index];
														if (item) item.port = event.target.value === "" ? null : Number(event.target.value);
													})
												}
											/>
										</Stack>
										<AdvancedOptionsEditor
											section="bind"
											testId={`advanced-bind-${index}`}
											label={bind.name || `Bind ${index + 1}`}
											extra={bind.extra}
											fields={bindFields}
											onChange={(extra) =>
												updateSnapshot((draft) => {
													const item = draft.frontends.find((frontend) => frontend.name === frontendContext.name)?.binds[index];
													if (item) item.extra = extra;
												})
											}
										/>
									</Stack>
								))}
							</Stack>
						</Stack>
					) : (
						<Typography color="text.secondary">No frontend selected.</Typography>
					)}
				</Stack>
			</Box>
		</Panel>
	);
}
