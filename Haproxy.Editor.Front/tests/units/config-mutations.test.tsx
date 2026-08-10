import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { useSaveConfig } from "@/core/api/mutations";
import { qk } from "@/core/api/queries";

const snapshot: HaproxyResourceSnapshot = {
	version: 2,
	global: { daemon: false },
	defaults: [],
	frontends: [],
	backends: [],
	summary: { frontendCount: 0, backendCount: 0, serverCount: 0 },
};

const { validateConfig, updateConfig } = vi.hoisted(() => ({
	validateConfig: vi.fn(async () => ({ success: true })),
	updateConfig: vi.fn(async () => snapshot),
}));

vi.mock("@/core/di/di", () => ({
	container: { get: () => ({ validateConfig, updateConfig }) },
}));

afterEach(() => {
	cleanup();
	validateConfig.mockClear();
	updateConfig.mockClear();
});

describe("configuration save mutation", () => {
	it("stores the canonical response and invalidates the dashboard after success", async () => {
		const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
		const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
		const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
			<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
		);
		const { result } = renderHook(useSaveConfig, { wrapper });

		await act(async () => result.current.mutateAsync({ ...snapshot, version: 1 }));

		expect(validateConfig).toHaveBeenCalledOnce();
		expect(updateConfig).toHaveBeenCalledOnce();
		expect(queryClient.getQueryData(qk.config)).toBe(snapshot);
		expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: qk.dashboard });
	});
});
