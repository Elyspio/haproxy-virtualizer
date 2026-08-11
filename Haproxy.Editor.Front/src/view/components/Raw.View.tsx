import { useMemo } from "react";
import { Box, Paper, Stack, Typography } from "@mui/material";
import { ConfigEditor } from "@components/shared/ConfigEditor";
import { useConfigurationDraft } from "@/view/context/configuration-draft.context";
import { useDashboardQuery } from "@/core/api/queries";

export function RawView() {
	const { snapshot } = useConfigurationDraft();
	const { data: dashboard } = useDashboardQuery();
	const content = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
	const runtimeContent = useMemo(() => JSON.stringify(dashboard ?? {}, null, 2), [dashboard]);

	return (
		<Stack spacing={2} sx={{ height: "100%", minHeight: 0, p: { xs: 1.5, md: 2 }, overflow: "hidden" }}>
			<Box>
				<Typography variant="h6">Raw Diagnostics</Typography>
				<Typography variant="body2" color="text.secondary">
					Read-only configuration and dashboard runtime snapshots
				</Typography>
			</Box>
			<Box sx={{ flex: 1, minHeight: 0, display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" }, overflow: "hidden" }}>
				<Paper sx={{ p: 1.5, height: "100%", minHeight: 0 }}>
					<Stack spacing={1} sx={{ height: "100%", minHeight: 0 }}>
						<Typography variant="subtitle2">Configuration Snapshot</Typography>
						<Box sx={{ flex: 1, minHeight: 0 }}>
							<ConfigEditor content={content} language="json" disabled />
						</Box>
					</Stack>
				</Paper>
				<Paper sx={{ p: 1.5, height: "100%", minHeight: 0 }}>
					<Stack spacing={1} sx={{ height: "100%", minHeight: 0 }}>
						<Typography variant="subtitle2">Runtime Dashboard Snapshot</Typography>
						<Box sx={{ flex: 1, minHeight: 0 }}>
							<ConfigEditor content={runtimeContent} language="json" disabled />
						</Box>
					</Stack>
				</Paper>
			</Box>
		</Stack>
	);
}
