import { Add, DeleteOutline, RocketLaunchOutlined } from "@mui/icons-material";
import { Autocomplete, Box, Button, Chip, Divider, IconButton, MenuItem, Paper, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { useState } from "react";
import type { HaproxyFrontendResource, HaproxyResourceSnapshot } from "@modules/config/config.types";
import type { DashboardSelection } from "@modules/dashboard/dashboard.types";
import { ACL_PRESET_OPTIONS, type AclPresetId, buildAclFromPresetState, createUniqueAclName } from "./acl.utils";
import { createAclClause, createGroupClause, serializeConditionExpression } from "./condition-expression.utils";
import { Panel, SectionHeader } from "./ManagementWorkspace.shared";

type QuickMapSectionProps = {
	snapshot: HaproxyResourceSnapshot;
	frontendContext: HaproxyFrontendResource | null;
	updateSnapshot: (updater: (draft: HaproxyResourceSnapshot) => void) => void;
	setSelection: (nextSelection: DashboardSelection) => void;
	focused: boolean;
};

type NewServer = { name: string; address: string; port: number | null };

type QuickMapDraft = {
	frontendName: string;
	backendMode: "existing" | "create";
	existingBackendName: string;
	newBackend: {
		name: string;
		mode: string;
		balance: string;
		advCheck: string;
		servers: (NewServer & { check: string })[];
	};
	matchType: AclPresetId;
	matchPrimary: string;
	matchSecondary: string;
	aclName: string;
	extraAclNames: string[];
	combineOperator: "and" | "or";
	cond: "if" | "unless";
};

function createInitialDraft(snapshot: HaproxyResourceSnapshot, frontendContext: HaproxyFrontendResource | null): QuickMapDraft {
	const backendIndex = snapshot.backends.length + 1;
	return {
		frontendName: frontendContext?.name ?? snapshot.frontends[0]?.name ?? "",
		backendMode: snapshot.backends.length > 0 ? "existing" : "create",
		existingBackendName: snapshot.backends[0]?.name ?? "",
		newBackend: {
			name: `backend_${backendIndex}`,
			mode: "http",
			balance: "roundrobin",
			advCheck: "",
			servers: [{ name: `backend_${backendIndex}_srv_1`, address: "10.0.0.1", port: 8080, check: "enabled" }],
		},
		matchType: "host",
		matchPrimary: "",
		matchSecondary: "",
		aclName: "",
		extraAclNames: [],
		combineOperator: "and",
		cond: "if",
	};
}

function buildExpressionPreview(draft: QuickMapDraft, generatedAclName: string): string {
	const hasMatch = draft.matchPrimary.trim() || draft.matchSecondary.trim();
	const allAclNames = hasMatch ? [generatedAclName, ...draft.extraAclNames] : [...draft.extraAclNames];

	if (allAclNames.length === 0) {
		return "";
	}

	if (allAclNames.length === 1) {
		return allAclNames[0];
	}

	const clauses = allAclNames.map((name) => createAclClause(name));
	const root = createGroupClause(draft.combineOperator, clauses);
	return serializeConditionExpression({ kind: "tree", root });
}

const MATCH_TYPE_SUBSET: AclPresetId[] = ["host", "host_prefix", "path_prefix", "path_exact", "path_regex", "source", "method", "header", "custom"];

export function deriveAclNameFromValue(matchType: AclPresetId, primary: string): string {
	const sanitized = primary
		.trim()
		.toLowerCase()
		.replace(/^[^a-z]+/, "")
		.replace(/[^a-z0-9_-]/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");

	if (!sanitized) return "";

	const prefix = matchType === "custom" ? "" : `${matchType}_`;
	return `${prefix}${sanitized}`;
}

export function QuickMapSection({ snapshot, frontendContext, updateSnapshot, setSelection, focused }: Readonly<QuickMapSectionProps>) {
	const theme = useTheme();
	const [draft, setDraft] = useState(() => createInitialDraft(snapshot, frontendContext));

	const updateDraft = (partial: Partial<QuickMapDraft>) => setDraft((prev) => ({ ...prev, ...partial }));

	const selectedFrontend = snapshot.frontends.find((f) => f.name === draft.frontendName) ?? null;
	const existingAclNames = [...new Set(selectedFrontend?.acls.map((acl) => acl.name) ?? [])];
	const resolvedAclName = draft.aclName.trim() || createUniqueAclName(existingAclNames, draft.matchType === "custom" ? "custom_acl" : `${draft.matchType}_acl`);
	const expressionPreview = buildExpressionPreview(draft, resolvedAclName);

	const targetBackendName = draft.backendMode === "existing" ? draft.existingBackendName : draft.newBackend.name;
	const hasMatch = draft.matchPrimary.trim() || draft.matchSecondary.trim();
	const canSubmit = Boolean(draft.frontendName && targetBackendName && (hasMatch || draft.extraAclNames.length > 0) && expressionPreview);

	const handleSubmit = () => {
		if (!canSubmit) return;

		updateSnapshot((snap) => {
			if (draft.backendMode === "create") {
				snap.backends.push({
					name: draft.newBackend.name,
					mode: draft.newBackend.mode || null,
					balance: draft.newBackend.balance || null,
					advCheck: draft.newBackend.advCheck || null,
					defaultServer: null,
					servers: draft.newBackend.servers.map((s) => ({
						name: s.name,
						address: s.address || null,
						port: s.port,
						check: s.check || null,
						ssl: null,
						verify: null,
						extra: null,
					})),
					extra: null,
				});
			}

			const frontend = snap.frontends.find((f) => f.name === draft.frontendName);
			if (!frontend) return;

			if (hasMatch) {
				const aclData = buildAclFromPresetState({
					preset: draft.matchType,
					primary: draft.matchPrimary,
					secondary: draft.matchSecondary,
				});
				frontend.acls.push({
					name: resolvedAclName,
					criterion: aclData.criterion,
					value: aclData.value,
				});
			}

			frontend.backendSwitchingRules.push({
				backendName: targetBackendName,
				cond: draft.cond,
				condTest: expressionPreview,
			});
		});

		setSelection({ section: "mapping", frontendName: draft.frontendName });
	};

	const addServer = () => {
		const servers = [...draft.newBackend.servers];
		servers.push({
			name: `${draft.newBackend.name}_srv_${servers.length + 1}`,
			address: "10.0.0.1",
			port: 8080,
			check: "enabled",
		});
		updateDraft({ newBackend: { ...draft.newBackend, servers } });
	};

	const removeServer = (index: number) => {
		const servers = draft.newBackend.servers.filter((_, i) => i !== index);
		updateDraft({ newBackend: { ...draft.newBackend, servers } });
	};

	const updateServer = (index: number, partial: Partial<NewServer>) => {
		const servers = [...draft.newBackend.servers];
		servers[index] = { ...servers[index], ...partial };
		updateDraft({ newBackend: { ...draft.newBackend, servers } });
	};

	return (
		<Panel
			title="Quick Map"
			subtitle="Map a backend to a hostname or route in one step"
			icon={<RocketLaunchOutlined fontSize="small" />}
			focused={focused}
			actions={
				<Button size="small" variant="contained" disabled={!canSubmit} onClick={handleSubmit}>
					Create Route
				</Button>
			}
		>
			<Box sx={{ height: "100%", minHeight: 0, overflow: "auto", p: 2 }}>
				<Stack spacing={3}>
					{/* Step 1: Frontend */}
					<Box>
						<SectionHeader title="1. Frontend" />
						<TextField
							size="small"
							select
							label="Frontend"
							fullWidth
							value={draft.frontendName}
							onChange={(e) => {
								updateDraft({ frontendName: e.target.value, extraAclNames: [] });
							}}
						>
							{snapshot.frontends.map((f) => (
								<MenuItem key={f.name} value={f.name}>
									{f.name}
								</MenuItem>
							))}
						</TextField>
					</Box>

					<Divider />

					{/* Step 2: Backend */}
					<Box>
						<SectionHeader title="2. Backend" />
						<Stack spacing={1.5}>
							<ToggleButtonGroup
								size="small"
								exclusive
								value={draft.backendMode}
								onChange={(_, value: string | null) => {
									if (value === "existing" || value === "create") updateDraft({ backendMode: value });
								}}
							>
								<ToggleButton value="existing">Existing</ToggleButton>
								<ToggleButton value="create">Create New</ToggleButton>
							</ToggleButtonGroup>

							{draft.backendMode === "existing" ? (
								<TextField
									size="small"
									select
									label="Backend"
									fullWidth
									value={draft.existingBackendName}
									onChange={(e) => updateDraft({ existingBackendName: e.target.value })}
								>
									{snapshot.backends.map((b) => (
										<MenuItem key={b.name} value={b.name}>
											{b.name}
										</MenuItem>
									))}
								</TextField>
							) : (
								<Paper variant="outlined" sx={{ p: 1.5, backgroundColor: alpha(theme.palette.background.default, 0.16) }}>
									<Stack spacing={1.5}>
										<TextField
											size="small"
											label="Name"
											fullWidth
											value={draft.newBackend.name}
											onChange={(e) => updateDraft({ newBackend: { ...draft.newBackend, name: e.target.value } })}
										/>
										<Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
											<TextField
												size="small"
												select
												label="Mode"
												fullWidth
												value={draft.newBackend.mode}
												onChange={(e) => updateDraft({ newBackend: { ...draft.newBackend, mode: e.target.value } })}
											>
												<MenuItem value="http">HTTP</MenuItem>
												<MenuItem value="tcp">TCP</MenuItem>
											</TextField>
											<TextField
												size="small"
												label="Balance"
												fullWidth
												value={draft.newBackend.balance}
												onChange={(e) => updateDraft({ newBackend: { ...draft.newBackend, balance: e.target.value } })}
											/>
											<TextField
												size="small"
												select
												label="Health Check"
												fullWidth
												value={draft.newBackend.advCheck}
												onChange={(e) => updateDraft({ newBackend: { ...draft.newBackend, advCheck: e.target.value } })}
											>
												<MenuItem value="">None</MenuItem>
												<MenuItem value="tcp-check">TCP check</MenuItem>
												<MenuItem value="httpchk">HTTP check</MenuItem>
											</TextField>
										</Stack>
										<SectionHeader
											title="Servers"
											action={
												<Button size="small" startIcon={<Add fontSize="small" />} onClick={addServer}>
													Add
												</Button>
											}
										/>
										{draft.newBackend.servers.map((server, index) => (
											<Stack key={index} direction="row" spacing={1} alignItems="center">
												<TextField
													size="small"
													label="Name"
													value={server.name}
													onChange={(e) => updateServer(index, { name: e.target.value })}
													sx={{ flex: 2 }}
												/>
												<TextField
													size="small"
													label="Address"
													value={server.address}
													onChange={(e) => updateServer(index, { address: e.target.value })}
													sx={{ flex: 2 }}
												/>
												<TextField
													size="small"
													label="Port"
													type="number"
													value={server.port ?? ""}
													onChange={(e) => updateServer(index, { port: e.target.value === "" ? null : Number(e.target.value) })}
													sx={{ flex: 1 }}
												/>
												<TextField
													size="small"
													select
													label="Check"
													value={server.check}
													onChange={(e) => {
														const servers = [...draft.newBackend.servers];
														servers[index] = { ...servers[index], check: e.target.value };
														updateDraft({ newBackend: { ...draft.newBackend, servers } });
													}}
													sx={{ flex: 1.2 }}
												>
													<MenuItem value="enabled">Enabled</MenuItem>
													<MenuItem value="disabled">Disabled</MenuItem>
												</TextField>
												<IconButton size="small" color="error" onClick={() => removeServer(index)}>
													<DeleteOutline fontSize="small" />
												</IconButton>
											</Stack>
										))}
									</Stack>
								</Paper>
							)}
						</Stack>
					</Box>

					<Divider />

					{/* Step 3: Route Match */}
					<Box>
						<SectionHeader title="3. Route Match" />
						<Stack spacing={1.5}>
							<TextField
								size="small"
								select
								label="Match Type"
								fullWidth
								value={draft.matchType}
								onChange={(e) => updateDraft({ matchType: e.target.value as AclPresetId, matchPrimary: "", matchSecondary: "", aclName: "" })}
							>
								{ACL_PRESET_OPTIONS.filter((opt) => MATCH_TYPE_SUBSET.includes(opt.value)).map((opt) => (
									<MenuItem key={opt.value} value={opt.value}>
										{opt.label}
									</MenuItem>
								))}
							</TextField>
							{draft.matchType === "header" || draft.matchType === "header_regex" ? (
								<Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
									<TextField
										size="small"
										label="Header Name"
										fullWidth
										value={draft.matchPrimary}
										onChange={(e) => updateDraft({ matchPrimary: e.target.value, aclName: deriveAclNameFromValue(draft.matchType, e.target.value) })}
									/>
									<TextField
										size="small"
										label={draft.matchType === "header" ? "Header Value" : "Header Regex"}
										fullWidth
										value={draft.matchSecondary}
										onChange={(e) => updateDraft({ matchSecondary: e.target.value })}
									/>
								</Stack>
							) : draft.matchType === "custom" ? (
								<Stack spacing={1.5}>
									<TextField
										size="small"
										label="Condition Type"
										fullWidth
										value={draft.matchPrimary}
										onChange={(e) => updateDraft({ matchPrimary: e.target.value, aclName: deriveAclNameFromValue(draft.matchType, e.target.value) })}
									/>
									<TextField
										size="small"
										label="Value"
										fullWidth
										value={draft.matchSecondary}
										onChange={(e) => updateDraft({ matchSecondary: e.target.value })}
									/>
								</Stack>
							) : (
								<TextField
									size="small"
									label={ACL_PRESET_OPTIONS.find((opt) => opt.value === draft.matchType)?.label ?? "Value"}
									fullWidth
									placeholder={draft.matchType === "host" || draft.matchType === "host_prefix" ? "example.com" : "/api"}
									value={draft.matchPrimary}
									onChange={(e) => updateDraft({ matchPrimary: e.target.value, aclName: deriveAclNameFromValue(draft.matchType, e.target.value) })}
								/>
							)}
							{hasMatch ? (
								<TextField
									size="small"
									label="ACL Name"
									fullWidth
									value={draft.aclName}
									onChange={(e) => updateDraft({ aclName: e.target.value })}
									helperText={`Will create ACL "${resolvedAclName}"`}
								/>
							) : null}
						</Stack>
					</Box>

					<Divider />

					{/* Step 4: Extra ACLs */}
					<Box>
						<SectionHeader title="4. Additional ACLs (optional)" />
						<Stack spacing={1.5}>
							{existingAclNames.length > 0 ? (
								<Autocomplete
									multiple
									size="small"
									options={existingAclNames}
									value={draft.extraAclNames}
									onChange={(_, next) => updateDraft({ extraAclNames: next })}
									renderTags={(value, getTagProps) =>
										value.map((option, index) => {
											const { key, ...tagProps } = getTagProps({ index });
											return <Chip key={key} size="small" label={option} {...tagProps} />;
										})
									}
									renderInput={(params) => <TextField {...params} label="Combine with existing ACLs" placeholder="Select ACLs" />}
								/>
							) : (
								<Typography variant="body2" color="text.secondary">
									No existing ACLs on this frontend.
								</Typography>
							)}
							{draft.extraAclNames.length > 0 && hasMatch ? (
								<Stack direction="row" spacing={1} alignItems="center">
									<Typography variant="body2">Combine with:</Typography>
									<ToggleButtonGroup
										size="small"
										exclusive
										value={draft.combineOperator}
										onChange={(_, value: string | null) => {
											if (value === "and" || value === "or") updateDraft({ combineOperator: value });
										}}
									>
										<ToggleButton value="and">AND</ToggleButton>
										<ToggleButton value="or">OR</ToggleButton>
									</ToggleButtonGroup>
								</Stack>
							) : null}
						</Stack>
					</Box>

					<Divider />

					{/* Step 5: Preview + Submit */}
					<Box>
						<SectionHeader title="5. Preview" />
						<Stack spacing={1.5}>
							<Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
								<TextField
									size="small"
									select
									label="Condition"
									value={draft.cond}
									onChange={(e) => updateDraft({ cond: e.target.value as "if" | "unless" })}
									sx={{ minWidth: 120 }}
								>
									<MenuItem value="if">if</MenuItem>
									<MenuItem value="unless">unless</MenuItem>
								</TextField>
								<TextField
									size="small"
									label="Expression"
									fullWidth
									value={expressionPreview}
									slotProps={{ input: { readOnly: true } }}
									helperText={
										expressionPreview ? `use_backend ${targetBackendName} ${draft.cond} ${expressionPreview}` : "Fill in the route match or select ACLs"
									}
								/>
							</Stack>
							<Button variant="contained" size="large" disabled={!canSubmit} onClick={handleSubmit} sx={{ alignSelf: "flex-start" }}>
								Create Route
							</Button>
						</Stack>
					</Box>
				</Stack>
			</Box>
		</Panel>
	);
}
