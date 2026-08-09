import React, { useEffect, useMemo } from "react";
import { Box } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import { withSnapshot } from "@modules/config/config.utils";
import { ensureExistingSelection, resolveSelectionFromSearchParams, serializeSelection } from "@modules/dashboard/dashboard.utils";
import type { DashboardSelection } from "@modules/dashboard/dashboard.types";
import { routes } from "@/config/view.config";
import { createUniqueAclName, getAclKindLabel, hasAclReference } from "@components/management/acl.utils";
import { useApplication } from "@/view/context/application.context";
import { useDashboardQuery } from "@/core/api/queries";

const MappingSection = React.lazy(() => import("@components/management/MappingSection").then((module) => ({ default: module.MappingSection })));
const QuickMapSection = React.lazy(() => import("@components/management/QuickMapSection").then((module) => ({ default: module.QuickMapSection })));
const FrontendManagementSection = React.lazy(() => import("@components/management/FrontendManagementSection").then((module) => ({ default: module.FrontendManagementSection })));
const BackendManagementSection = React.lazy(() => import("@components/management/BackendManagementSection").then((module) => ({ default: module.BackendManagementSection })));
const AclLibrarySection = React.lazy(() => import("@components/management/AclLibrarySection").then((module) => ({ default: module.AclLibrarySection })));
const GlobalConfigSection = React.lazy(() => import("@components/management/GlobalConfigSection").then((module) => ({ default: module.GlobalConfigSection })));

export function ManagementWorkspace() {
	const navigate = useNavigate();
	const location = useLocation();
	const { snapshot, setSnapshot, selection, setSelection: setApplicationSelection } = useApplication();
	const { data: dashboard } = useDashboardQuery();
	const runtimeBackends = dashboard?.backends ?? [];

	const effectiveSelection = useMemo(() => ensureExistingSelection(selection, snapshot), [selection, snapshot]);

	useEffect(() => {
		const requestedSelection = resolveSelectionFromSearchParams(new URLSearchParams(location.search));
		const nextSelection = ensureExistingSelection(requestedSelection, snapshot);

		if (JSON.stringify(nextSelection) !== JSON.stringify(selection)) {
			setApplicationSelection(nextSelection);
		}
	}, [location.search, selection, setApplicationSelection, snapshot]);

	useEffect(() => {
		if (JSON.stringify(effectiveSelection) !== JSON.stringify(selection)) {
			setApplicationSelection(effectiveSelection);
			void navigate(`${routes.dashboard.management.path}?${serializeSelection(effectiveSelection)}`, { replace: true });
		}
	}, [effectiveSelection, navigate, selection, setApplicationSelection]);

	const frontendContext = useMemo(() => {
		const selectedFrontend = snapshot.frontends.find((frontend) => frontend.name === effectiveSelection.frontendName) ?? null;

		if (selectedFrontend) {
			return selectedFrontend;
		}

		return effectiveSelection.section === "frontend" ||
			effectiveSelection.section === "mapping" ||
			effectiveSelection.section === "acl" ||
			effectiveSelection.section === "quickmap"
			? (snapshot.frontends[0] ?? null)
			: null;
	}, [effectiveSelection.frontendName, effectiveSelection.section, snapshot.frontends]);

	const frontendRelatedBackendNames = useMemo(() => {
		const names = new Set<string>();
		if (!frontendContext) {
			return names;
		}

		if (frontendContext.defaultBackend) {
			names.add(frontendContext.defaultBackend);
		}

		for (const rule of frontendContext.backendSwitchingRules) {
			if (rule.backendName) {
				names.add(rule.backendName);
			}
		}

		return names;
	}, [frontendContext]);

	const frontendScopedBackends = useMemo(
		() => snapshot.backends.filter((backend) => frontendRelatedBackendNames.has(backend.name)),
		[frontendRelatedBackendNames, snapshot.backends],
	);

	const shouldFilterBackendPanel = Boolean(frontendContext && effectiveSelection.section === "backend" && effectiveSelection.frontendName);
	const backendCandidates = shouldFilterBackendPanel ? frontendScopedBackends : snapshot.backends;
	const selectedBackend = useMemo(
		() => backendCandidates.find((backend) => backend.name === effectiveSelection.backendName) ?? backendCandidates[0] ?? null,
		[backendCandidates, effectiveSelection.backendName],
	);
	const selectedRuntimeBackend = runtimeBackends.find((backend) => backend.name === selectedBackend?.name) ?? null;

	const aclFrontendName = frontendContext?.name ?? snapshot.frontends.find((frontend) => frontend.acls.length > 0)?.name ?? snapshot.frontends[0]?.name ?? null;
	const aclEntries = useMemo(
		() =>
			snapshot.frontends.flatMap((frontend) => {
				const groupedEntries = new Map<
					string,
					{
						id: string;
						frontendName: string;
						acl: (typeof frontend.acls)[number];
						usages: Array<{ id: string; backendName: string; cond: string | null; condTest: string | null }>;
						usageCount: number;
						duplicateCount: number;
					}
				>();

				for (const acl of frontend.acls) {
					const existingEntry = groupedEntries.get(acl.name);
					if (existingEntry) {
						existingEntry.duplicateCount += 1;
						continue;
					}

					const usages = frontend.backendSwitchingRules
						.map((rule, index) => ({
							id: `${frontend.name}-${rule.backendName}-${index}`,
							...rule,
						}))
						.filter((rule) => hasAclReference(rule.condTest, acl.name));

					groupedEntries.set(acl.name, {
						id: `${frontend.name}::${acl.name}`,
						frontendName: frontend.name,
						acl,
						usages,
						usageCount: usages.length,
						duplicateCount: 1,
					});
				}

				return [...groupedEntries.values()];
			}),
		[snapshot.frontends],
	);

	const filteredAclEntries = useMemo(() => aclEntries.filter((entry) => entry.frontendName === aclFrontendName), [aclEntries, aclFrontendName]);
	const groupedAclEntries = useMemo(() => {
		const groups = new Map<string, typeof filteredAclEntries>();

		for (const entry of filteredAclEntries) {
			const kindLabel = getAclKindLabel(entry.acl);
			const currentEntries = groups.get(kindLabel) ?? [];
			currentEntries.push(entry);
			groups.set(kindLabel, currentEntries);
		}

		return [...groups.entries()]
			.sort((left, right) => left[0].localeCompare(right[0]))
			.map(([kindLabel, entries]) => ({
				kindLabel,
				entries: [...entries].sort((left, right) => left.acl.name.localeCompare(right.acl.name)),
			}));
	}, [filteredAclEntries]);

	const selectedAclEntry = useMemo(
		() => filteredAclEntries.find((entry) => entry.acl.name === effectiveSelection.aclName) ?? filteredAclEntries[0] ?? null,
		[effectiveSelection.aclName, filteredAclEntries],
	);
	const selectedAclUsages = selectedAclEntry?.usages ?? [];
	const mappingRules = frontendContext?.backendSwitchingRules ?? [];
	const mappingAcls = frontendContext?.acls ?? [];

	const setSelection = (nextSelection: DashboardSelection) => {
		setApplicationSelection(nextSelection);
		void navigate(`${routes.dashboard.management.path}?${serializeSelection(nextSelection)}`);
	};

	const updateSnapshot = (updater: Parameters<typeof withSnapshot>[1]) => {
		setSnapshot(withSnapshot(snapshot, updater));
	};

	const createAcl = (frontendName?: string | null) => {
		const ownerFrontendName = frontendName ?? frontendContext?.name ?? snapshot.frontends[0]?.name ?? null;
		if (!ownerFrontendName) {
			return;
		}

		const existingAcls = snapshot.frontends.find((frontend) => frontend.name === ownerFrontendName)?.acls ?? [];
		const aclName = createUniqueAclName(
			existingAcls.map((acl) => acl.name),
			`acl_${existingAcls.length + 1}`,
		);

		updateSnapshot((draft) => {
			const frontend = draft.frontends.find((item) => item.name === ownerFrontendName);
			frontend?.acls.push({
				name: aclName,
				criterion: "path_beg",
				value: "/api",
			});
		});

		setSelection({ section: "acl", frontendName: ownerFrontendName, aclName });
	};

	const moveSelectedAcl = (nextFrontendName: string) => {
		if (!selectedAclEntry || nextFrontendName === selectedAclEntry.frontendName || selectedAclUsages.length > 0) {
			return;
		}

		updateSnapshot((draft) => {
			const sourceFrontend = draft.frontends.find((item) => item.name === selectedAclEntry.frontendName);
			const targetFrontend = draft.frontends.find((item) => item.name === nextFrontendName);
			if (!sourceFrontend || !targetFrontend) {
				return;
			}

			const movedAcls = sourceFrontend.acls.filter((item) => item.name === selectedAclEntry.acl.name);
			if (movedAcls.length === 0) {
				return;
			}

			sourceFrontend.acls = sourceFrontend.acls.filter((item) => item.name !== selectedAclEntry.acl.name);

			const nextAclName = createUniqueAclName(
				targetFrontend.acls.map((acl) => acl.name),
				selectedAclEntry.acl.name,
			);

			targetFrontend.acls.push(
				...movedAcls.map((acl) => ({
					...acl,
					name: nextAclName,
				})),
			);
		});

		const nextAclName = createUniqueAclName(
			(snapshot.frontends.find((frontend) => frontend.name === nextFrontendName)?.acls ?? []).map((acl) => acl.name),
			selectedAclEntry.acl.name,
		);

		setSelection({ section: "acl", frontendName: nextFrontendName, aclName: nextAclName });
	};

	const deleteSelectedAcl = () => {
		if (!selectedAclEntry || selectedAclUsages.length > 0) {
			return;
		}

		updateSnapshot((draft) => {
			const frontend = draft.frontends.find((item) => item.name === selectedAclEntry.frontendName);
			if (!frontend) {
				return;
			}

			frontend.acls = frontend.acls.filter((acl) => acl.name !== selectedAclEntry.acl.name);
		});

		setSelection({ section: "acl", frontendName: selectedAclEntry.frontendName });
	};

	const createMappingRule = () => {
		if (!frontendContext || snapshot.backends.length === 0) {
			return;
		}

		const firstBackend = snapshot.backends[0]?.name ?? "";
		const firstAcl = frontendContext.acls[0]?.name ?? "";

		updateSnapshot((draft) => {
			const frontend = draft.frontends.find((item) => item.name === frontendContext.name);
			frontend?.backendSwitchingRules.push({
				backendName: firstBackend,
				cond: "if",
				condTest: firstAcl,
			});
		});

		setSelection({ section: "mapping", frontendName: frontendContext.name, backendName: firstBackend });
	};

	const deleteMappingRule = (ruleIndex: number) => {
		if (!frontendContext) {
			return;
		}

		updateSnapshot((draft) => {
			const frontend = draft.frontends.find((item) => item.name === frontendContext.name);
			frontend?.backendSwitchingRules.splice(ruleIndex, 1);
		});
	};

	const isGlobalSection = effectiveSelection.section === "global" || effectiveSelection.section === "defaults";
	const isGlobalFocused = isGlobalSection;
	const isContextFocused = effectiveSelection.section === "mapping" || effectiveSelection.section === "acl" || effectiveSelection.section === "quickmap";

	return (
		<Box sx={{ height: "100%", minHeight: 0, overflow: "hidden", p: { xs: 1.5, md: 2 } }}>
			<Box sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
				{isGlobalSection ? <GlobalConfigSection snapshot={snapshot} updateSnapshot={updateSnapshot} focused={isGlobalFocused} /> : null}
				{effectiveSelection.section === "frontend" ? (
					<FrontendManagementSection
						snapshot={snapshot}
						frontendContext={frontendContext}
						frontendRelatedBackendNames={frontendRelatedBackendNames}
						updateSnapshot={updateSnapshot}
						setSelection={setSelection}
						focused={effectiveSelection.section === "frontend"}
					/>
				) : null}
				{effectiveSelection.section === "backend" ? (
					<BackendManagementSection
						snapshot={snapshot}
						runtimeBackends={runtimeBackends}
						frontendContext={frontendContext}
						backendCandidates={backendCandidates}
						selectedBackend={selectedBackend}
						selectedRuntimeBackend={selectedRuntimeBackend}
						shouldFilterBackendPanel={shouldFilterBackendPanel}
						updateSnapshot={updateSnapshot}
						setSelection={setSelection}
						focused={effectiveSelection.section === "backend"}
					/>
				) : null}
				{effectiveSelection.section === "acl" ? (
					<AclLibrarySection
						snapshot={snapshot}
						aclFrontendName={aclFrontendName}
						groupedAclEntries={groupedAclEntries}
						selectedAclEntry={selectedAclEntry}
						selectedAclUsages={selectedAclUsages}
						updateSnapshot={updateSnapshot}
						setSelection={setSelection}
						createAcl={createAcl}
						moveSelectedAcl={moveSelectedAcl}
						deleteSelectedAcl={deleteSelectedAcl}
						focused={isContextFocused}
					/>
				) : null}
				{effectiveSelection.section === "mapping" ? (
					<MappingSection
						snapshot={snapshot}
						frontendContext={frontendContext}
						mappingRules={mappingRules}
						mappingAcls={mappingAcls}
						frontendRelatedBackendNames={frontendRelatedBackendNames}
						updateSnapshot={updateSnapshot}
						setSelection={setSelection}
						createMappingRule={createMappingRule}
						deleteMappingRule={deleteMappingRule}
						focused={isContextFocused}
					/>
				) : null}
				{effectiveSelection.section === "quickmap" ? (
					<QuickMapSection snapshot={snapshot} frontendContext={frontendContext} updateSnapshot={updateSnapshot} setSelection={setSelection} focused={isContextFocused} />
				) : null}
			</Box>
		</Box>
	);
}
