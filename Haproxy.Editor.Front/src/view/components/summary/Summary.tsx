import { useMemo } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Box, Chip, LinearProgress, List, ListItem, ListItemText, Paper, Stack, Typography } from "@mui/material";
import { useConfigurationDraft } from "@/view/context/configuration-draft.context";
import { useDashboardQuery } from "@/core/api/queries";
import { createEmptyDashboardSnapshot } from "@modules/dashboard/dashboard.utils";
import type { DashboardKpi, RuntimeBackendStatus } from "@modules/dashboard/dashboard.types";

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
	const value = bytes / Math.pow(1024, i);
	return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`;
}

function useToneColor(tone: string) {
	const theme = useTheme();
	const colorMap: Record<string, string> = {
		critical: theme.palette.error.main,
		warning: theme.palette.warning.main,
		success: theme.palette.success.main,
		info: theme.palette.info.main,
		neutral: theme.palette.text.secondary,
	};
	return colorMap[tone] ?? theme.palette.primary.main;
}

function Sparkline({ data, color, height = 36 }: Readonly<{ data: number[]; color: string; height?: number }>) {
	const max = Math.max(...data, 1);
	const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${height - 4 - (v / max) * (height - 8)}`).join(" ");
	const areaPoints = `0,${height} ${points} 100,${height}`;

	return (
		<svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none">
			<defs>
				<linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor={color} stopOpacity="0.2" />
					<stop offset="100%" stopColor={color} stopOpacity="0" />
				</linearGradient>
			</defs>
			<polygon fill={`url(#grad-${color.replace("#", "")})`} points={areaPoints} />
			<polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
		</svg>
	);
}

function KpiCard({ title, value, subtitle, tone, trend }: Readonly<DashboardKpi>) {
	const color = useToneColor(tone);

	return (
		<Paper sx={{ p: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 138 }}>
			<Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
				<Box>
					<Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
						{title}
					</Typography>
					<Typography sx={{ fontSize: 32, lineHeight: 1.1, fontWeight: 700, color, mt: 0.25 }}>{value}</Typography>
				</Box>
				<Chip
					size="small"
					label={tone}
					sx={{ textTransform: "uppercase", fontWeight: 700, fontSize: "0.65rem", color, borderColor: alpha(color, 0.36) }}
					variant="outlined"
				/>
			</Stack>
			<Box>
				<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
					{subtitle}
				</Typography>
				{trend.length > 1 ? (
					<Box sx={{ mt: 1, height: 36 }}>
						<Sparkline data={trend} color={color} />
					</Box>
				) : null}
			</Box>
		</Paper>
	);
}

function useAggregatedStats(backends: RuntimeBackendStatus[]) {
	return useMemo(() => {
		let totalSessions = 0;
		let totalSessionRate = 0;
		let totalBytesIn = 0;
		let totalBytesOut = 0;
		let totalHealthy = 0;
		let totalDown = 0;
		let totalMaintenance = 0;
		let totalServers = 0;

		for (const b of backends) {
			totalSessions += b.currentSessions;
			totalSessionRate += b.sessionRate;
			totalBytesIn += b.bytesIn;
			totalBytesOut += b.bytesOut;
			totalHealthy += b.healthyServers;
			totalDown += b.downServers;
			totalMaintenance += b.maintenanceServers;
			totalServers += b.servers.length;
		}

		return { totalSessions, totalSessionRate, totalBytesIn, totalBytesOut, totalHealthy, totalDown, totalMaintenance, totalServers };
	}, [backends]);
}

function MetricTile({ label, value, unit, color }: Readonly<{ label: string; value: string | number; unit?: string; color?: string }>) {
	const theme = useTheme();

	return (
		<Box sx={{ flex: 1, minWidth: 100 }}>
			<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "0.06em", mb: 0.25 }}>
				{label}
			</Typography>
			<Stack direction="row" alignItems="baseline" spacing={0.5}>
				<Typography sx={{ fontSize: 22, fontWeight: 700, lineHeight: 1.15, color: color ?? theme.palette.text.primary }}>{value}</Typography>
				{unit ? (
					<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
						{unit}
					</Typography>
				) : null}
			</Stack>
		</Box>
	);
}

function TrafficOverview({ backends }: Readonly<{ backends: RuntimeBackendStatus[] }>) {
	const theme = useTheme();
	const stats = useAggregatedStats(backends);

	return (
		<Paper sx={{ p: 2, flex: 1 }}>
			<Typography variant="subtitle2" sx={{ mb: 2, opacity: 0.8 }}>
				Traffic
			</Typography>
			<Stack spacing={2.5}>
				<Stack direction="row" sx={{ flexWrap: "wrap", gap: 2.5 }}>
					<MetricTile label="Active Sessions" value={stats.totalSessions} color={theme.palette.info.main} />
					<MetricTile label="Session Rate" value={stats.totalSessionRate} unit="/s" color={theme.palette.primary.main} />
				</Stack>
				<Stack direction="row" sx={{ flexWrap: "wrap", gap: 2.5 }}>
					<MetricTile label="Bytes In" value={formatBytes(stats.totalBytesIn)} color={theme.palette.success.main} />
					<MetricTile label="Bytes Out" value={formatBytes(stats.totalBytesOut)} color={theme.palette.secondary.main} />
				</Stack>
			</Stack>
		</Paper>
	);
}

function ServerHealth({ backends }: Readonly<{ backends: RuntimeBackendStatus[] }>) {
	const theme = useTheme();
	const stats = useAggregatedStats(backends);
	const healthyPct = stats.totalServers > 0 ? (stats.totalHealthy / stats.totalServers) * 100 : 0;

	return (
		<Paper sx={{ p: 2, flex: 1 }}>
			<Typography variant="subtitle2" sx={{ mb: 2, opacity: 0.8 }}>
				Server Health
			</Typography>
			<Stack spacing={2.5}>
				<Box>
					<Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
						<Typography variant="body2" sx={{ fontSize: "0.75rem" }}>
							{stats.totalHealthy} / {stats.totalServers} healthy
						</Typography>
						<Typography
							variant="body2"
							sx={{
								fontWeight: 700,
								fontSize: "0.75rem",
								color: healthyPct >= 80 ? theme.palette.success.main : healthyPct >= 50 ? theme.palette.warning.main : theme.palette.error.main,
							}}
						>
							{Math.round(healthyPct)}%
						</Typography>
					</Stack>
					<LinearProgress
						variant="determinate"
						value={healthyPct}
						sx={{
							height: 6,
							borderRadius: 3,
							backgroundColor: alpha(theme.palette.text.secondary, 0.1),
							"& .MuiLinearProgress-bar": {
								borderRadius: 3,
								backgroundColor: healthyPct >= 80 ? theme.palette.success.main : healthyPct >= 50 ? theme.palette.warning.main : theme.palette.error.main,
							},
						}}
					/>
				</Box>
				<Stack direction="row" sx={{ flexWrap: "wrap", gap: 2.5 }}>
					<MetricTile label="Healthy" value={stats.totalHealthy} color={theme.palette.success.main} />
					<MetricTile label="Down" value={stats.totalDown} color={stats.totalDown > 0 ? theme.palette.error.main : undefined} />
					<MetricTile label="Maintenance" value={stats.totalMaintenance} color={stats.totalMaintenance > 0 ? theme.palette.warning.main : undefined} />
				</Stack>
			</Stack>
		</Paper>
	);
}

function BackendBreakdown({ backends }: Readonly<{ backends: RuntimeBackendStatus[] }>) {
	const theme = useTheme();

	if (backends.length === 0) {
		return null;
	}

	const sorted = [...backends].sort((a, b) => b.currentSessions - a.currentSessions);
	const maxSessions = Math.max(...sorted.map((b) => b.currentSessions), 1);

	return (
		<Paper sx={{ p: 2, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
			<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
				<Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
					Backend Activity
				</Typography>
				<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
					{backends.length} backends
				</Typography>
			</Stack>
			<Stack spacing={1} sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
				{sorted.map((backend) => {
					const statusColor = backend.status === "up" ? theme.palette.success.main : backend.status === "down" ? theme.palette.error.main : theme.palette.warning.main;
					const barWidth = maxSessions > 0 ? (backend.currentSessions / maxSessions) * 100 : 0;

					return (
						<Box key={backend.name}>
							<Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
								<Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
									<Box
										sx={{
											width: 7,
											height: 7,
											borderRadius: "50%",
											backgroundColor: statusColor,
											flexShrink: 0,
											boxShadow: `0 0 6px ${alpha(statusColor, 0.5)}`,
										}}
									/>
									<Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: "0.8rem" }}>
										{backend.name}
									</Typography>
								</Stack>
								<Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
									<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
										{backend.sessionRate}/s
									</Typography>
									<Typography variant="body2" sx={{ fontSize: "0.7rem", fontWeight: 600, minWidth: 36, textAlign: "right" }}>
										{backend.currentSessions}
									</Typography>
								</Stack>
							</Stack>
							<Box
								sx={{
									height: 3,
									borderRadius: 1.5,
									backgroundColor: alpha(theme.palette.text.secondary, 0.08),
									overflow: "hidden",
								}}
							>
								<Box
									sx={{
										height: "100%",
										width: `${barWidth}%`,
										borderRadius: 1.5,
										backgroundColor: alpha(theme.palette.primary.main, 0.55),
										transition: "width 0.4s ease",
									}}
								/>
							</Box>
						</Box>
					);
				})}
			</Stack>
		</Paper>
	);
}

function ActiveAlerts() {
	const theme = useTheme();
	const { data: dashboard } = useDashboardQuery();
	const alerts = dashboard?.alerts ?? [];

	return (
		<Paper sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
			<Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
				<Typography variant="subtitle2" sx={{ opacity: 0.8 }}>
					Active Alerts
				</Typography>
				{alerts.length > 0 ? (
					<Chip
						size="small"
						label={alerts.length}
						color={alerts.some((a) => a.severity === "critical") ? "error" : "warning"}
						sx={{ fontWeight: 700, minWidth: 28, height: 22 }}
					/>
				) : null}
			</Stack>
			<Box sx={{ flex: 1, minHeight: 0, overflow: "auto", p: 1.5 }}>
				{alerts.length > 0 ? (
					<List disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
						{alerts.map((alert) => {
							const isCritical = alert.severity === "critical";
							const accentColor = isCritical ? theme.palette.error.main : theme.palette.warning.main;
							return (
								<ListItem
									key={alert.id}
									sx={{
										borderRadius: 2,
										border: `1px solid ${alpha(accentColor, 0.25)}`,
										backgroundColor: alpha(accentColor, 0.06),
										py: 0.75,
									}}
								>
									<Box sx={{ width: 4, height: 28, borderRadius: 2, backgroundColor: accentColor, flexShrink: 0, mr: 1.5 }} />
									<ListItemText
										primary={alert.message}
										secondary={`${alert.resourceType ?? "system"}${alert.resourceName ? ` · ${alert.resourceName}` : ""}`}
										primaryTypographyProps={{ variant: "body2", fontWeight: 600, fontSize: "0.8rem" }}
										secondaryTypographyProps={{ variant: "body2", fontSize: "0.7rem" }}
									/>
									<Chip size="small" label={alert.severity} color={isCritical ? "error" : "warning"} sx={{ fontWeight: 700, fontSize: "0.65rem", height: 22 }} />
								</ListItem>
							);
						})}
					</List>
				) : (
					<Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }} spacing={0.75}>
						<Typography variant="body1" sx={{ fontWeight: 600, opacity: 0.6 }}>
							No active alerts
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.75rem" }}>
							All systems operating normally.
						</Typography>
					</Stack>
				)}
			</Box>
		</Paper>
	);
}

export function Summary() {
	const { snapshot } = useConfigurationDraft();
	const dashboard = useDashboardQuery().data ?? createEmptyDashboardSnapshot();
	const { summary, backends } = dashboard;
	const configSummary = snapshot.summary;

	return (
		<Stack spacing={2} sx={{ height: "100%", minHeight: 0, p: { xs: 1.5, md: 2 }, overflow: "auto" }}>
			{/* Header */}
			<Stack direction="row" justifyContent="space-between" alignItems="flex-end">
				<Box>
					<Typography variant="h6">Dashboard</Typography>
					<Typography variant="body2" color="text.secondary">
						Operational cockpit · {configSummary.frontendCount} frontends · {configSummary.backendCount} backends · {configSummary.serverCount} servers
					</Typography>
				</Box>
				<Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}>
					{summary.runtimeStatus} · {new Date(summary.generatedAt).toLocaleTimeString()}
				</Typography>
			</Stack>

			{/* KPI Row */}
			<Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", "& > *": { flex: "1 1 200px", minWidth: 200 } }}>
				<KpiCard {...summary.alerts} />
				<KpiCard {...summary.routes} />
				<KpiCard {...summary.services} />
			</Box>

			{/* Traffic + Health Row */}
			<Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", "& > *": { minWidth: 260 } }}>
				<TrafficOverview backends={backends} />
				<ServerHealth backends={backends} />
			</Box>

			{/* Backend Breakdown + Alerts */}
			<Box sx={{ display: "flex", gap: 2, flex: 1, minHeight: 200, flexWrap: "wrap", "& > *": { minWidth: 280 } }}>
				<BackendBreakdown backends={backends} />
				<ActiveAlerts />
			</Box>
		</Stack>
	);
}
