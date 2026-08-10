import * as React from "react";
import { Backdrop, Box, CircularProgress, Stack, Typography } from "@mui/material";
import { Outlet } from "react-router";
import { SidebarDashboard } from "@components/dashboard/Sidebar.Dashboard";
import HaproxyIcon from "@/view/icons/HaproxyIcon";
import { DashboardHeader } from "@components/dashboard/Header.Dashboard";
import { useConfigurationDraft } from "@/view/context/configuration-draft.context";

export function DashboardLayout() {
	const [navigationExpanded, setNavigationExpanded] = React.useState(true);

	return (
		<Box
			sx={{
				display: "flex",
				height: "100dvh",
				width: "100%",
				overflow: "hidden",
			}}
		>
			<SidebarDashboard expanded={navigationExpanded} setExpanded={setNavigationExpanded} />
			<Box
				sx={{
					display: "flex",
					flexDirection: "column",
					flex: 1,
					minWidth: 0,
					minHeight: 0,
				}}
			>
				<DashboardHeader logo={<HaproxyIcon />} menuOpen={navigationExpanded} onToggleMenu={setNavigationExpanded} />
				<Box component="main" sx={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
					<Outlet />
				</Box>
			</Box>
			<ConfigurationSaveOverlay />
		</Box>
	);
}

export function ConfigurationSaveOverlay() {
	const { isDraftLocked } = useConfigurationDraft();

	return (
		<Backdrop data-testid="configuration-save-overlay" open={isDraftLocked} sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}>
			<Stack alignItems="center" spacing={2}>
				<CircularProgress color="inherit" />
				<Typography>Saving configuration…</Typography>
			</Stack>
		</Backdrop>
	);
}
