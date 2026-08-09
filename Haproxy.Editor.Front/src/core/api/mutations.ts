import { useMutation, useQueryClient } from "@tanstack/react-query";
import { container } from "@/core/di/di";
import { ConfigService } from "@services/config.service";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { qk } from "./queries";

export function useSaveConfig() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (snapshot: HaproxyResourceSnapshot) => {
			const service = container.get(ConfigService);
			const validation = await service.validateConfig(snapshot);
			if (!validation.success) throw new Error(validation.error);
			return service.updateConfig(snapshot);
		},
		onSuccess: (snapshot) => {
			queryClient.setQueryData(qk.config, snapshot);
			void queryClient.invalidateQueries({ queryKey: qk.dashboard });
		},
	});
}

export function useValidateConfig() {
	return useMutation({
		mutationFn: (snapshot: HaproxyResourceSnapshot) => container.get(ConfigService).validateConfig(snapshot),
	});
}
