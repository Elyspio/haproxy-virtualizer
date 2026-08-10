import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { qk, useDashboardQuery } from "@/core/api/queries";

const { getDashboardSnapshot } = vi.hoisted(() => ({
	getDashboardSnapshot: vi.fn(async () => ({
		summary: { runtimeStatus: "up", frontendCount: 0, backendCount: 0, serverCount: 0, healthyServerCount: 0 },
		alerts: [],
		backends: [],
	})),
}));

vi.mock("@/core/di/di", () => ({
	container: { get: () => ({ getDashboardSnapshot }) },
}));

function DashboardConsumer() {
	const query = useDashboardQuery();
	return <div>{query.isSuccess ? "ready" : "loading"}</div>;
}

function wrapperFor(queryClient: QueryClient) {
	return function QueryWrapper({ children }: Readonly<{ children: ReactNode }>) {
		return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
	};
}

afterEach(() => {
	cleanup();
	getDashboardSnapshot.mockClear();
	vi.useRealTimers();
});

describe("dashboard query caching", () => {
	it("does not refetch on remount after the normal cache collection horizon", async () => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const wrapper = wrapperFor(queryClient);
		const first = render(<DashboardConsumer />, { wrapper });
		await screen.findByText("ready");
		expect(getDashboardSnapshot).toHaveBeenCalledOnce();

		first.unmount();
		await act(async () => vi.advanceTimersByTime(6 * 60 * 1000));
		render(<DashboardConsumer />, { wrapper });
		expect(screen.getByText("ready")).toBeTruthy();
		expect(getDashboardSnapshot).toHaveBeenCalledOnce();
	});

	it("refetches after explicit invalidation", async () => {
		const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
		const wrapper = wrapperFor(queryClient);
		render(<DashboardConsumer />, { wrapper });
		await screen.findByText("ready");

		await queryClient.invalidateQueries({ queryKey: qk.dashboard });
		await waitFor(() => expect(getDashboardSnapshot).toHaveBeenCalledTimes(2));
	});
});
