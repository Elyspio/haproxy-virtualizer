import { inject, injectable } from "inversify";
import { Api } from "@apis/api";
import type { HaproxyResourceSnapshot } from "@modules/config/config.types";
import { normalizeSnapshot } from "@modules/config/config.utils";

type ValidateConfigResult = { success: true } | { success: false; error: string };

@injectable()
export class ConfigService {
	constructor(@inject(Api) private readonly api: Api) {}

	async getConfig(): Promise<HaproxyResourceSnapshot> {
		const { data } = await this.api.axios.get(`${this.api.baseUrl}/config`);
		return normalizeSnapshot(data);
	}

	async updateConfig(config: HaproxyResourceSnapshot): Promise<HaproxyResourceSnapshot> {
		const { data } = await this.api.axios.put(`${this.api.baseUrl}/config`, config);
		return normalizeSnapshot(data);
	}

	async validateConfig(config: HaproxyResourceSnapshot): Promise<ValidateConfigResult> {
		try {
			await this.api.axios.post(`${this.api.baseUrl}/config/validate`, config);
			return { success: true };
		} catch (e: any) {
			const error = e.response?.data?.detail ?? e.response?.data?.title ?? e.message ?? "Unknown error";
			return { success: false, error: String(error) };
		}
	}
}
