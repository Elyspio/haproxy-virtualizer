import { inject, injectable } from "inversify";
import { Api } from "@apis/api";
import type { DashboardSnapshot } from "@modules/dashboard/dashboard.types";
import { normalizeDashboardSnapshot } from "@modules/dashboard/dashboard.utils";

@injectable()
export class DashboardService {
	constructor(@inject(Api) private readonly api: Api) {}

	async getDashboardSnapshot(): Promise<DashboardSnapshot> {
		const { data } = await this.api.axios.get(`${this.api.baseUrl}/dashboard`);
		return normalizeDashboardSnapshot(data);
	}
}
