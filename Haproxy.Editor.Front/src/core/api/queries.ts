import { useQuery } from "@tanstack/react-query";
import { container } from "@/core/di/di";
import { ConfigService } from "@services/config.service";
import { DashboardService } from "@services/dashboard.service";
import { SchemaService } from "@services/schema.service";

export const qk = {
	config: ["config"] as const,
	dashboard: ["dashboard"] as const,
	schema: ["schema"] as const,
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
		staleTime: Infinity,
		gcTime: Infinity,
		enabled,
	});
}

/**
 * The advanced-field catalogue. It only changes when the API is redeployed, so it is fetched once and kept.
 */
export function useSchemaQuery(enabled = true) {
	return useQuery({
		queryKey: qk.schema,
		queryFn: () => container.get(SchemaService).getSchema(),
		staleTime: Infinity,
		enabled,
	});
}
