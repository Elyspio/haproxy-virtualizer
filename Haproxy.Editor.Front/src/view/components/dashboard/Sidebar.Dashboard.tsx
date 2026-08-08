import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { Box, Divider, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import {
	AnalyticsOutlined,
	DataObjectOutlined,
	DnsOutlined,
	HubOutlined,
	Inventory2Outlined,
	LanOutlined,
	RocketLaunchOutlined,
	TuneOutlined,
	ViewQuiltOutlined,
} from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { routes } from "@/config/view.config";
import { serializeSelection } from "@modules/dashboard/dashboard.utils";
import { useApplication } from "@/view/context/application.context";

export interface DashboardSidebarProps {
	expanded?: boolean;
	setExpanded: (expanded: boolean) => void;
}

const DRAWER_WIDTH = 272;
const MINI_DRAWER_WIDTH = 88;

type NavigationItem = {
	label: string;
	icon: React.ReactNode;
	path: string;
	selection: { section: "summary" | "global" | "defaults" | "frontend" | "mapping" | "backend" | "acl" | "quickmap" | "raw" };
};

export function SidebarDashboard({ expanded = true, setExpanded }: Readonly<DashboardSidebarProps>) {
	const theme = useTheme();
	const location = useLocation();
	const navigate = useNavigate();
	const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
	const { selection: currentSelection, setSelection } = useApplication();
	const width = expanded ? DRAWER_WIDTH : MINI_DRAWER_WIDTH;

	const dashboardItems: NavigationItem[] = [
		{ label: "Summary", icon: <AnalyticsOutlined />, path: routes.dashboard.summary.path, selection: { section: "summary" } },
		{ label: "Flow", icon: <ViewQuiltOutlined />, path: routes.dashboard.flow.path, selection: { section: "summary" } },
	];

	const modifyItems: NavigationItem[] = [
		{
			label: "Globals & Defaults",
			icon: <TuneOutlined />,
			path: `${routes.dashboard.management.path}?${serializeSelection({ section: "global" })}`,
			selection: { section: "global" },
		},
		{
			label: "Frontends",
			icon: <LanOutlined />,
			path: `${routes.dashboard.management.path}?${serializeSelection({ section: "frontend" })}`,
			selection: { section: "frontend" },
		},
		{ label: "Mapping", icon: <HubOutlined />, path: `${routes.dashboard.management.path}?${serializeSelection({ section: "mapping" })}`, selection: { section: "mapping" } },
		{ label: "Backends", icon: <DnsOutlined />, path: `${routes.dashboard.management.path}?${serializeSelection({ section: "backend" })}`, selection: { section: "backend" } },
		{
			label: "ACL Library",
			icon: <Inventory2Outlined />,
			path: `${routes.dashboard.management.path}?${serializeSelection({ section: "acl" })}`,
			selection: { section: "acl" },
		},
		{
			label: "Quick Map",
			icon: <RocketLaunchOutlined />,
			path: `${routes.dashboard.management.path}?${serializeSelection({ section: "quickmap" })}`,
			selection: { section: "quickmap" },
		},
		{ label: "Raw", icon: <DataObjectOutlined />, path: routes.raw.view.path, selection: { section: "raw" } },
	];

	const content = (
		<Box
			sx={{
				height: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.88 : 0.72),
				backdropFilter: "blur(20px)",
			}}
		>
			<Box sx={{ px: expanded ? 2 : 1, py: 2.25 }}>
				<Typography variant="subtitle2" color="text.secondary" sx={{ px: expanded ? 1 : 0, textAlign: expanded ? "left" : "center" }}>
					{expanded ? "Dashboard" : "DB"}
				</Typography>
				<List dense disablePadding sx={{ mt: 1, display: "grid", gap: 0.5 }}>
					{dashboardItems.map((item) => (
						<ListItemButton
							key={item.label}
							selected={location.pathname === item.path && currentSelection.section === item.selection.section}
							onClick={() => {
								setSelection(item.selection);
								void navigate(item.path);
								if (!isDesktop) setExpanded(false);
							}}
							sx={{ justifyContent: expanded ? "flex-start" : "center" }}
						>
							<ListItemIcon sx={{ minWidth: expanded ? 36 : 0, color: "inherit" }}>{item.icon}</ListItemIcon>
							{expanded ? <ListItemText primary={item.label} /> : null}
						</ListItemButton>
					))}
				</List>
			</Box>

			<Divider />

			<Box sx={{ flex: 1, minHeight: 0, px: expanded ? 2 : 1, py: 2, overflow: "auto" }}>
				<Typography variant="subtitle2" color="text.secondary" sx={{ px: expanded ? 1 : 0, textAlign: expanded ? "left" : "center" }}>
					{expanded ? "Modify" : "MD"}
				</Typography>
				<List dense disablePadding sx={{ mt: 1, display: "grid", gap: 0.5 }}>
					{modifyItems.map((item) => (
						<ListItemButton
							key={item.label}
							selected={
								(location.pathname === routes.dashboard.management.path || location.pathname === routes.raw.view.path) &&
								currentSelection.section === item.selection.section
							}
							onClick={() => {
								setSelection(item.selection);
								void navigate(item.path);
								if (!isDesktop) setExpanded(false);
							}}
							sx={{ justifyContent: expanded ? "flex-start" : "center" }}
						>
							<ListItemIcon sx={{ minWidth: expanded ? 36 : 0, color: "inherit" }}>{item.icon}</ListItemIcon>
							{expanded ? <ListItemText primary={item.label} /> : null}
						</ListItemButton>
					))}
				</List>
			</Box>
		</Box>
	);

	if (!isDesktop) {
		return (
			<Drawer
				variant="temporary"
				open={expanded}
				onClose={() => setExpanded(false)}
				sx={{
					display: { xs: "block", lg: "none" },
					[`& .MuiDrawer-paper`]: {
						width: DRAWER_WIDTH,
						boxSizing: "border-box",
						borderRight: `1px solid ${theme.palette.divider}`,
					},
				}}
			>
				{content}
			</Drawer>
		);
	}

	return (
		<Box
			sx={{
				width,
				flexShrink: 0,
				borderRight: `1px solid ${theme.palette.divider}`,
				transition: theme.transitions.create("width"),
				display: { xs: "none", lg: "block" },
			}}
		>
			{content}
		</Box>
	);
}
