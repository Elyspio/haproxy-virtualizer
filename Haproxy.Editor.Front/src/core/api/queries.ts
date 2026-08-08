import { useQuery } from "@tanstack/react-query";
import { container } from "@/core/di/di";
import { ConfigService } from "@services/config.service";
import { DashboardService } from "@services/dashboard.service";

export const qk = {
	config: ["config"] as const,
	dashboard: ["dashboard"] as const,
};

export function useConfigQuery(enabled = true) {
	return useQuery({
		queryKey: qk.config,
		queryFn: () => container.get(ConfigService).getConfig(),
		enabled,
	});
}

export function useDashboardQuery(enabled = true) {
	return useQuery({
		queryKey: qk.dashboard,
		queryFn: () => container.get(DashboardService).getDashboardSnapshot(),
		enabled,
	});
}
