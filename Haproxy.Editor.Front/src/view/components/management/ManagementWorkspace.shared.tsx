import { useMemo, type ReactNode } from "react";
import { Box, Chip, Paper, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { ConfigToolbar } from "@components/shared/ConfigToolbar";

const HAPROXY_KEYWORDS = new Set(["frontend", "backend", "listen", "defaults", "global"]);
const HAPROXY_DIRECTIVES = new Set([
	"mode",
	"balance",
	"bind",
	"server",
	"option",
	"default_backend",
	"use_backend",
	"acl",
	"timeout",
	"log",
	"stats",
	"maxconn",
	"retries",
	"http-request",
	"http-response",
]);

export function Panel({
	title,
	subtitle,
	icon,
	actions,
	children,
	focused = false,
}: Readonly<{ title: string; subtitle?: string; icon?: ReactNode; actions?: ReactNode; children: ReactNode; focused?: boolean }>) {
	const theme = useTheme();

	return (
		<Paper
			sx={{
				height: "100%",
				minHeight: 0,
				display: "flex",
				flexDirection: "column",
				overflow: "hidden",
				backgroundColor: theme.palette.background.paper,
				border: `1px solid ${alpha(focused ? theme.palette.primary.main : theme.palette.divider, focused ? 0.42 : 1)}`,
				boxShadow: focused
					? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.18)}, 0 24px 48px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.24 : 0.08)}`
					: undefined,
				transition: theme.transitions.create(["border-color", "box-shadow", "background-color"]),
			}}
		>
			<Stack
				direction="row"
				alignItems="center"
				justifyContent="space-between"
				spacing={2}
				sx={{
					px: 2.25,
					py: 1.75,
					borderBottom: `1px solid ${alpha(focused ? theme.palette.primary.main : theme.palette.divider, focused ? 0.28 : 1)}`,
					background: focused ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.background.paper, 0.92)})` : "transparent",
				}}
			>
				<Stack direction="row" alignItems="center" spacing={1.25}>
					<Box
						sx={{
							display: "grid",
							placeItems: "center",
							width: 36,
							height: 36,
							borderRadius: 2.5,
							backgroundColor: alpha(theme.palette.primary.main, focused ? 0.22 : 0.14),
							color: focused ? theme.palette.primary.light : theme.palette.primary.main,
						}}
					>
						{icon}
					</Box>
					<Box>
						<Stack direction="row" spacing={1} alignItems="center">
							<Typography variant="h6">{title}</Typography>
							{focused ? <Chip size="small" color="primary" label="Active" /> : null}
						</Stack>
						{subtitle ? (
							<Typography variant="body2" color="text.secondary">
								{subtitle}
							</Typography>
						) : null}
					</Box>
				</Stack>
				<Stack direction="row" alignItems="center" spacing={1.5}>
					{actions}
					<ConfigToolbar />
				</Stack>
			</Stack>
			<Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>{children}</Box>
		</Paper>
	);
}

export function SectionHeader({ title, action }: Readonly<{ title: string; action?: ReactNode }>) {
	return (
		<Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
			<Typography variant="subtitle2">{title}</Typography>
			{action}
		</Stack>
	);
}

function tokenizeLine(line: string): ReactNode[] {
	const trimmed = line.trimStart();
	const indent = line.length - trimmed.length;
	const parts = trimmed.split(/\s+/);
	const nodes: ReactNode[] = [];

	if (indent > 0) {
		nodes.push(line.slice(0, indent));
	}

	for (let i = 0; i < parts.length; i++) {
		if (i > 0) nodes.push(" ");
		const word = parts[i];

		if (i === 0 && indent === 0 && HAPROXY_KEYWORDS.has(word)) {
			nodes.push(
				<span key={i} style={{ fontWeight: 700 }}>
					{word}
				</span>,
			);
		} else if (i === 0 && HAPROXY_DIRECTIVES.has(word)) {
			nodes.push(
				<span key={i} className="cfg-directive">
					{word}
				</span>,
			);
		} else if (word.startsWith("#")) {
			nodes.push(
				<span key={i} className="cfg-comment">
					{parts.slice(i).join(" ")}
				</span>,
			);
			break;
		} else if (/^\d+$/.test(word) || /^\d+\.\d+\.\d+\.\d+:\d+$/.test(word) || /^[\d.*]+:\d+$/.test(word)) {
			nodes.push(
				<span key={i} className="cfg-value">
					{word}
				</span>,
			);
		} else if (i === 1 && indent === 0) {
			nodes.push(
				<span key={i} className="cfg-name">
					{word}
				</span>,
			);
		} else {
			nodes.push(word);
		}
	}

	return nodes;
}

export function ConfigPreview({ config }: Readonly<{ config: string }>) {
	const theme = useTheme();
	const isDark = theme.palette.mode === "dark";

	const lines = useMemo(() => config.split("\n"), [config]);

	const directiveColor = isDark ? "#7ec8e3" : "#1565c0";
	const commentColor = isDark ? "#6a9955" : "#4e7a3e";
	const valueColor = isDark ? "#ce9178" : "#b5533d";
	const nameColor = isDark ? "#dcdcaa" : "#795e26";
	const lineNumColor = isDark ? alpha(theme.palette.text.primary, 0.22) : alpha(theme.palette.text.primary, 0.28);
	const lineNumBorder = isDark ? alpha(theme.palette.divider, 0.4) : alpha(theme.palette.divider, 0.6);

	return (
		<Paper
			variant="outlined"
			data-testid="config-preview"
			sx={{
				borderRadius: 2.5,
				overflow: "hidden",
				backgroundColor: isDark ? alpha(theme.palette.background.default, 0.6) : alpha(theme.palette.background.default, 0.45),
				"& .cfg-directive": { color: directiveColor },
				"& .cfg-comment": { color: commentColor, fontStyle: "italic" },
				"& .cfg-value": { color: valueColor },
				"& .cfg-name": { color: nameColor },
			}}
		>
			<Stack
				direction="row"
				alignItems="center"
				justifyContent="space-between"
				sx={{
					px: 1.5,
					py: 0.75,
					borderBottom: `1px solid ${theme.palette.divider}`,
					backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.5) : alpha(theme.palette.background.paper, 0.8),
				}}
			>
				<Typography
					variant="caption"
					sx={{
						fontWeight: 600,
						letterSpacing: 1.4,
						textTransform: "uppercase",
						color: "text.secondary",
						fontSize: 10.5,
					}}
				>
					HAProxy Config Preview
				</Typography>
				<Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
					{lines.length} {lines.length === 1 ? "line" : "lines"}
				</Typography>
			</Stack>
			<Box
				sx={{
					overflowX: "auto",
					py: 1,
					fontFamily: "'IBM Plex Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
					fontSize: 12.5,
					lineHeight: 1.75,
					color: theme.palette.text.primary,
				}}
			>
				{lines.map((line, i) => (
					<Box
						key={i}
						sx={{
							display: "flex",
							px: 1.5,
							"&:hover": {
								backgroundColor: alpha(theme.palette.primary.main, 0.04),
							},
						}}
					>
						<Box
							component="span"
							sx={{
								width: 32,
								flexShrink: 0,
								textAlign: "right",
								pr: 1.5,
								mr: 1.5,
								borderRight: `1px solid ${lineNumBorder}`,
								color: lineNumColor,
								userSelect: "none",
								fontSize: 11,
							}}
						>
							{i + 1}
						</Box>
						<Box component="span" sx={{ whiteSpace: "pre", minWidth: 0 }}>
							{tokenizeLine(line)}
						</Box>
					</Box>
				))}
			</Box>
		</Paper>
	);
}
