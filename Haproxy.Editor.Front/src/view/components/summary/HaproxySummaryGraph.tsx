import { memo, useEffect, useMemo, useRef, useState } from "react";
import { alpha, useTheme } from "@mui/material/styles";
import { Avatar, Box, Chip, Paper, Stack, Typography } from "@mui/material";
import dagre from "@dagrejs/dagre";
import { type Edge, Handle, MarkerType, type Node, Position, ReactFlow, type ReactFlowInstance } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useApplication } from "@/view/context/application.context";
import { useDashboardQuery } from "@/core/api/queries";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";

type FlowCardData = {
	title: string;
	subtitle: string;
	accent: string;
	status?: string;
	kind: "frontend" | "backend" | "server" | "host";
};

type FlowNode = Node<FlowCardData>;

const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
const nodeWidth = 228;
const nodeHeight = 88;
const fitViewOptions = {
	padding: 0.06,
	minZoom: 0.72,
	maxZoom: 1.08,
	duration: 320,
};
const kindLabels: Record<FlowCardData["kind"], string> = {
	frontend: "Entry",
	backend: "Route",
	server: "Service",
	host: "Host",
};

export function convertSnapshotToFlow(snapshot: HaproxyResourceSnapshot): { nodes: FlowNode[]; edges: Edge[] } {
	const nodes: FlowNode[] = [];
	const edges: Edge[] = [];

	for (const frontend of snapshot.frontends) {
		nodes.push({
			id: `frontend-${frontend.name}`,
			type: "flowCard",
			position: { x: 0, y: 0 },
			data: {
				title: frontend.name,
				subtitle: frontend.binds.map((bind) => `${bind.address ?? "*"}:${bind.port ?? ""}`).join(" · ") || "No bind",
				accent: "#ffb15d",
				kind: "frontend",
			},
		});

		for (const backend of snapshot.backends) {
			const hasDirectLink = frontend.defaultBackend === backend.name || frontend.backendSwitchingRules.some((rule) => rule.backendName === backend.name);
			if (!hasDirectLink) {
				continue;
			}

			nodes.push({
				id: `backend-${backend.name}`,
				type: "flowCard",
				position: { x: 0, y: 0 },
				data: {
					title: backend.name,
					subtitle: `${backend.balance ?? "roundrobin"} · ${backend.mode ?? "tcp"}`,
					accent: "#64c7ff",
					kind: "backend",
				},
			});

			edges.push({
				id: `edge-${frontend.name}-${backend.name}`,
				source: `frontend-${frontend.name}`,
				target: `backend-${backend.name}`,
			});

			for (const server of backend.servers) {
				nodes.push({
					id: `backend-${backend.name}-${server.name}`,
					type: "flowCard",
					position: { x: 0, y: 0 },
					data: {
						title: server.name,
						subtitle: `${server.address ?? ""}:${server.port ?? ""}`,
						accent: "#78d9a1",
						kind: "server",
					},
				});

				edges.push({
					id: `edge-${backend.name}-${server.name}`,
					source: `backend-${backend.name}`,
					target: `backend-${backend.name}-${server.name}`,
				});
			}
		}
	}

	return {
		nodes,
		edges,
	};
}

function FlowCardNode({ data }: Readonly<{ data: FlowCardData }>) {
	const theme = useTheme();

	return (
		<Paper
			sx={{
				width: nodeWidth,
				px: 1.5,
				py: 1.3,
				borderRadius: 3.5,
				border: `1px solid ${alpha(data.accent, 0.22)}`,
				background: `linear-gradient(135deg, ${alpha(data.accent, theme.palette.mode === "dark" ? 0.2 : 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
				boxShadow: theme.palette.mode === "dark" ? `0 14px 28px ${alpha("#020617", 0.35)}` : `0 14px 28px ${alpha("#8aa4c8", 0.18)}`,
				position: "relative",
				overflow: "hidden",
				"&::before": {
					content: '""',
					position: "absolute",
					inset: "0 auto 0 0",
					width: 4,
					background: `linear-gradient(180deg, ${alpha(data.accent, 0.92)} 0%, ${alpha(data.accent, 0.38)} 100%)`,
				},
			}}
		>
			{data.kind !== "frontend" && <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />}
			{data.kind !== "server" && data.kind !== "host" && <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />}
			<Stack spacing={1}>
				<Stack direction="row" alignItems="center" justifyContent="space-between">
					<Stack direction="row" alignItems="center" spacing={1}>
						<Avatar sx={{ width: 28, height: 28, bgcolor: alpha(data.accent, 0.2), color: data.accent, fontSize: 13, fontWeight: 700 }}>
							{data.kind.charAt(0).toUpperCase()}
						</Avatar>
						<Box sx={{ minWidth: 0 }}>
							<Typography variant="overline" sx={{ display: "block", lineHeight: 1.1, color: alpha(data.accent, 0.96), fontWeight: 700, letterSpacing: "0.08em" }}>
								{kindLabels[data.kind]}
							</Typography>
							<Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
								{data.title}
							</Typography>
							<Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
								{data.subtitle}
							</Typography>
						</Box>
					</Stack>
					{data.status ? (
						<Chip
							label={data.status}
							size="small"
							color={data.status === "down" ? "error" : data.status === "maintenance" ? "warning" : "success"}
							sx={{ height: 22, textTransform: "uppercase", fontSize: 11, fontWeight: 700 }}
						/>
					) : null}
				</Stack>
			</Stack>
		</Paper>
	);
}

const nodeTypes = {
	flowCard: memo(FlowCardNode),
};

function layoutElements(nodes: FlowNode[], edges: Edge[], flowViewMode: "logical" | "infrastructure") {
	const isDenseLayout = nodes.length >= 10;
	graph.setGraph({
		rankdir: "LR",
		align: "UL",
		nodesep: flowViewMode === "logical" ? (isDenseLayout ? 28 : 40) : isDenseLayout ? 32 : 44,
		ranksep: flowViewMode === "logical" ? (isDenseLayout ? 84 : 104) : isDenseLayout ? 108 : 128,
		marginx: 24,
		marginy: 20,
	});

	for (const node of nodes) {
		graph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
	}

	for (const edge of edges) {
		graph.setEdge(edge.source, edge.target);
	}

	dagre.layout(graph);

	return nodes.map((node) => {
		const position = graph.node(node.id);
		return {
			...node,
			sourcePosition: Position.Right,
			targetPosition: Position.Left,
			position: {
				x: position.x - nodeWidth / 2,
				y: position.y - nodeHeight / 2,
			},
		};
	});
}

export function HaproxySummaryGraph() {
	const theme = useTheme();
	const { snapshot, flowViewMode } = useApplication();
	const { data: dashboard } = useDashboardQuery();
	const runtimeBackends = dashboard?.backends ?? [];
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<FlowNode, Edge> | null>(null);

	const elements = useMemo(() => {
		const nextNodes: FlowNode[] = [];
		const nextEdges: Edge[] = [];

		if (flowViewMode === "logical") {
			for (const frontend of snapshot.frontends) {
				nextNodes.push({
					id: `frontend-${frontend.name}`,
					type: "flowCard",
					position: { x: 0, y: 0 },
					data: {
						title: frontend.name,
						subtitle: frontend.binds.map((bind) => `${bind.address ?? "*"}:${bind.port ?? ""}`).join(" · ") || "No bind",
						accent: "#ffb15d",
						kind: "frontend",
					},
				});

				for (const backend of snapshot.backends) {
					const hasDirectLink = frontend.defaultBackend === backend.name || frontend.backendSwitchingRules.some((rule) => rule.backendName === backend.name);
					if (!hasDirectLink) {
						continue;
					}

					const runtimeBackend = runtimeBackends.find((item) => item.name === backend.name);
					const routingLabel =
						frontend.backendSwitchingRules.find((rule) => rule.backendName === backend.name)?.condTest ?? (frontend.defaultBackend === backend.name ? "default" : "");
					nextNodes.push({
						id: `backend-${backend.name}`,
						type: "flowCard",
						position: { x: 0, y: 0 },
						data: {
							title: backend.name,
							subtitle: `${backend.balance ?? "roundrobin"} · ${backend.mode ?? "tcp"}`,
							accent: "#64c7ff",
							status: runtimeBackend?.status,
							kind: "backend",
						},
					});
					nextEdges.push({
						id: `edge-${frontend.name}-${backend.name}`,
						source: `frontend-${frontend.name}`,
						target: `backend-${backend.name}`,
						label: routingLabel,
						markerEnd: { type: MarkerType.ArrowClosed },
						style: { stroke: alpha(theme.palette.text.primary, 0.3), strokeWidth: 1.4 },
						labelStyle: { fill: theme.palette.text.secondary, fontWeight: 700, fontSize: 11 },
						labelBgStyle: { fill: alpha(theme.palette.background.paper, 0.9), fillOpacity: 0.94 },
						labelBgBorderRadius: 10,
						labelBgPadding: [8, 4],
					});

					for (const server of backend.servers) {
						const runtimeServer = runtimeBackend?.servers.find((item) => item.name === server.name);
						nextNodes.push({
							id: `server-${backend.name}-${server.name}`,
							type: "flowCard",
							position: { x: 0, y: 0 },
							data: {
								title: server.name,
								subtitle: `${server.address ?? ""}:${server.port ?? ""}`,
								accent: "#78d9a1",
								status: runtimeServer?.status,
								kind: "server",
							},
						});
						nextEdges.push({
							id: `edge-${backend.name}-${server.name}`,
							source: `backend-${backend.name}`,
							target: `server-${backend.name}-${server.name}`,
							markerEnd: { type: MarkerType.ArrowClosed },
							style: { stroke: alpha(theme.palette.text.primary, 0.22), strokeWidth: 1.2 },
						});
					}
				}
			}
		} else {
			const hosts = new Map<string, { id: string; title: string }>();

			for (const backend of snapshot.backends) {
				const runtimeBackend = runtimeBackends.find((item) => item.name === backend.name);
				nextNodes.push({
					id: `backend-${backend.name}`,
					type: "flowCard",
					position: { x: 0, y: 0 },
					data: {
						title: backend.name,
						subtitle: `${backend.servers.length} services`,
						accent: "#64c7ff",
						status: runtimeBackend?.status,
						kind: "backend",
					},
				});

				for (const server of backend.servers) {
					const hostId = server.address ?? `${backend.name}-${server.name}`;
					if (!hosts.has(hostId)) {
						hosts.set(hostId, {
							id: `host-${hostId}`,
							title: server.address ?? server.name,
						});
					}

					nextEdges.push({
						id: `edge-${backend.name}-${hostId}-${server.name}`,
						source: `backend-${backend.name}`,
						target: `host-${hostId}`,
						label: server.name,
						markerEnd: { type: MarkerType.ArrowClosed },
						style: { stroke: alpha(theme.palette.text.primary, 0.24), strokeWidth: 1.2 },
						labelStyle: { fill: theme.palette.text.secondary, fontSize: 11 },
						labelBgStyle: { fill: alpha(theme.palette.background.paper, 0.88), fillOpacity: 0.92 },
						labelBgBorderRadius: 10,
						labelBgPadding: [8, 4],
					});
				}
			}

			for (const host of hosts.values()) {
				nextNodes.push({
					id: host.id,
					type: "flowCard",
					position: { x: 0, y: 0 },
					data: {
						title: host.title,
						subtitle: "Infrastructure host",
						accent: "#c38bff",
						kind: "host",
					},
				});
			}
		}

		const dedupedNodes = Array.from(new Map(nextNodes.map((node) => [node.id, node])).values());

		return {
			nodes: layoutElements(dedupedNodes, nextEdges, flowViewMode),
			edges: nextEdges,
		};
	}, [flowViewMode, runtimeBackends, snapshot.backends, snapshot.frontends, theme.palette.text.primary, theme.palette.text.secondary]);

	useEffect(() => {
		if (!flowInstance || elements.nodes.length === 0) {
			return;
		}

		const animationFrame = window.requestAnimationFrame(() => {
			void flowInstance.fitView(fitViewOptions);
		});

		return () => window.cancelAnimationFrame(animationFrame);
	}, [elements.edges, elements.nodes, flowInstance]);

	useEffect(() => {
		if (!flowInstance || !containerRef.current) {
			return;
		}

		const observer = new ResizeObserver(() => {
			void flowInstance.fitView(fitViewOptions);
		});
		observer.observe(containerRef.current);

		return () => observer.disconnect();
	}, [flowInstance]);

	return (
		<Box
			ref={containerRef}
			sx={{
				width: "100%",
				height: "100%",
				borderRadius: 3,
				overflow: "hidden",
				background:
					theme.palette.mode === "dark"
						? "radial-gradient(circle at top left, rgba(79, 116, 255, 0.14), transparent 34%), linear-gradient(180deg, #0d1626 0%, #0a1220 100%)"
						: "radial-gradient(circle at top left, rgba(98, 168, 255, 0.16), transparent 30%), linear-gradient(180deg, #f7fbff 0%, #edf4ff 100%)",
			}}
		>
			<ReactFlow
				nodes={elements.nodes}
				edges={elements.edges}
				nodeTypes={nodeTypes}
				onInit={setFlowInstance}
				proOptions={{ hideAttribution: true }}
				nodesDraggable={false}
				nodesConnectable={false}
				elementsSelectable={false}
				zoomOnScroll={false}
				panOnScroll
				panOnDrag
				onlyRenderVisibleElements
				minZoom={0.55}
				maxZoom={1.2}
				style={{
					backgroundImage:
						theme.palette.mode === "dark"
							? "linear-gradient(rgba(139, 171, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 171, 255, 0.06) 1px, transparent 1px)"
							: "linear-gradient(rgba(40, 72, 120, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(40, 72, 120, 0.06) 1px, transparent 1px)",
					backgroundSize: "28px 28px",
				}}
			/>
		</Box>
	);
}
