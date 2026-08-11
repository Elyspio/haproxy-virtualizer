import { useTheme } from "@mui/material/styles";
import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { HaproxySummaryGraph } from "./HaproxySummaryGraph";
import { useWorkspaceNavigation } from "@/view/context/workspace-navigation.context";
import { useDashboardQuery } from "@/core/api/queries";

export function FlowDashboard() {
	const theme = useTheme();
	const { flowViewMode, setFlowViewMode } = useWorkspaceNavigation();
	const { data: dashboard } = useDashboardQuery();
	const summary = dashboard?.summary;
	const alerts = dashboard?.alerts ?? [];

	return (
		<Stack spacing={2} sx={{ height: "100%", minHeight: 0, p: { xs: 1.5, md: 2 }, overflow: "hidden" }}>
			<Box>
				<Typography variant="h6">Flow</Typography>
				<Typography variant="body2" color="text.secondary">
					Dedicated runtime topology view with {alerts.length} active alerts
				</Typography>
			</Box>

			<Paper sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
				<Stack
					direction={{ xs: "column", md: "row" }}
					justifyContent="space-between"
					alignItems={{ xs: "flex-start", md: "center" }}
					spacing={1.5}
					sx={{ px: 2.25, py: 1.75, borderBottom: `1px solid ${theme.palette.divider}` }}
				>
					<Box>
						<Typography variant="h6">Topology Workspace</Typography>
						<Typography variant="body2" color="text.secondary">
							Runtime {summary?.runtimeStatus ?? "loading"} · Generated {summary ? new Date(summary.generatedAt).toLocaleTimeString() : "--"}
						</Typography>
					</Box>

					<Stack direction="row" spacing={1}>
						<Button variant={flowViewMode === "logical" ? "contained" : "outlined"} size="small" onClick={() => setFlowViewMode("logical")}>
							Logical Flow
						</Button>
						<Button variant={flowViewMode === "infrastructure" ? "contained" : "outlined"} size="small" onClick={() => setFlowViewMode("infrastructure")}>
							Infrastructure Topology
						</Button>
					</Stack>
				</Stack>

				<Box sx={{ flex: 1, minHeight: 0, p: 2, overflow: "hidden" }}>
					<HaproxySummaryGraph />
				</Box>
			</Paper>
		</Stack>
	);
}
