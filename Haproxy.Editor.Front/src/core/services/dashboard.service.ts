import { inject, injectable } from "inversify";
import { Api } from "@apis/api";
import type { DashboardSnapshot } from "@modules/dashboard/dashboard.types";
import { normalizeDashboardSnapshot } from "@modules/dashboard/dashboard.utils";

@injectable()
export class DashboardService {
	constructor(@inject(Api) private readonly api: Api) {}

	async getDashboardSnapshot(bypassCache = false): Promise<DashboardSnapshot> {
		const requestConfig = bypassCache
			? {
					headers: { "Cache-Control": "no-cache" },
				}
			: undefined;
		const { data } = await this.api.axios.get(`${this.api.baseUrl}/dashboard`, requestConfig);
		return normalizeDashboardSnapshot(data);
	}
}
