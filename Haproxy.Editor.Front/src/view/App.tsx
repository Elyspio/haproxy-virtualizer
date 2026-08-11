import { createBrowserRouter, createRoutesFromChildren, Navigate, Route, RouterProvider } from "react-router-dom";
import { AuthProvider } from "@/view/context/auth.context";
import { ProtectedRoute } from "@components/auth/ProtectedRoute";
import { AuthCallback } from "@pages/AuthCallback";
import { routes } from "@/config/view.config";
import { DashboardLayout } from "@pages/DashboardLayout";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { ToastContainer } from "react-toastify";
import { Summary } from "@components/summary/Summary";
import { createCockpitTheme } from "./theme/cockpit.theme";
import React, { useMemo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApplicationProvider } from "@/view/context/application.context";
import { ConfigurationBoundary } from "@/view/context/configuration-draft.context";
import { useThemeMode } from "@/view/context/theme-mode.context";

const FlowDashboard = React.lazy(() => import("@components/summary/Flow.Dashboard").then((module) => ({ default: module.FlowDashboard })));
const ManagementWorkspace = React.lazy(() => import("@components/Management.Workspace").then((module) => ({ default: module.ManagementWorkspace })));
const RawView = React.lazy(() => import("@components/Raw.View").then((module) => ({ default: module.RawView })));

const router = createBrowserRouter(
	createRoutesFromChildren(
		<>
			<Route path={routes.oauth.callback.path} element={<AuthCallback />} />
			<Route
				path={routes.dashboard.summary.path}
				element={
					<ProtectedRoute>
						<ConfigurationBoundary>
							<DashboardLayout />
						</ConfigurationBoundary>
					</ProtectedRoute>
				}
			>
				<Route index element={<Summary />} />
				<Route path={routes.dashboard.flow.path.slice(1)} element={<FlowDashboard />} />
				<Route path={routes.dashboard.management.path.slice(1)} element={<ManagementWorkspace />} />
				<Route path={routes.raw.view.path.slice(1)} element={<RawView />} />
				<Route path={routes.frontend.create.path} element={<Navigate replace to={`${routes.dashboard.management.path}?section=frontend`} />} />
				<Route path={routes.frontend.edit.path} element={<Navigate replace to={`${routes.dashboard.management.path}?section=frontend`} />} />
				<Route path={routes.backend.create.path} element={<Navigate replace to={`${routes.dashboard.management.path}?section=backend`} />} />
				<Route path={routes.backend.edit.path} element={<Navigate replace to={`${routes.dashboard.management.path}?section=backend`} />} />
				<Route path={routes.global.edit.path} element={<Navigate replace to={`${routes.dashboard.management.path}?section=global`} />} />
				<Route path={routes.default.edit.path} element={<Navigate replace to={`${routes.dashboard.management.path}?section=global`} />} />
			</Route>
		</>,
	),
);

window["haproxy-editor"].router = router;

const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function AppShell() {
	const { themeMode } = useThemeMode();
	const theme = useMemo(() => createCockpitTheme(themeMode), [themeMode]);

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<RouterProvider router={router} />
			<ToastContainer theme={themeMode} />
		</ThemeProvider>
	);
}

export const App = () => {
	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<ApplicationProvider>
					<AppShell />
				</ApplicationProvider>
			</AuthProvider>
		</QueryClientProvider>
	);
};
