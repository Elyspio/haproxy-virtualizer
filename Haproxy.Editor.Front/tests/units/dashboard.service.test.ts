import { describe, expect, it, vi } from "vitest";
import type { Api } from "@apis/api";
import { DashboardService } from "@services/dashboard.service";

const snapshot = {
	summary: {
		generatedAt: "2026-08-10T00:00:00Z",
		runtimeStatus: "up",
		alerts: { title: "Alerts", value: 0, subtitle: "None", tone: "success", trend: [] },
		routes: { title: "Routes", value: 0, subtitle: "None", tone: "neutral", trend: [] },
		services: { title: "Services", value: 0, subtitle: "None", tone: "info", trend: [] },
	},
	alerts: [],
	backends: [],
};

describe("DashboardService", () => {
	it("bypasses the server cache only for an explicit refresh", async () => {
		const get = vi.fn().mockResolvedValue({ data: snapshot });
		const service = new DashboardService({ baseUrl: "/api", axios: { get } } as unknown as Api);

		await service.getDashboardSnapshot();
		await service.getDashboardSnapshot(true);

		expect(get).toHaveBeenNthCalledWith(1, "/api/dashboard", undefined);
		expect(get).toHaveBeenNthCalledWith(2, "/api/dashboard", {
			headers: { "Cache-Control": "no-cache" },
		});
	});
});
