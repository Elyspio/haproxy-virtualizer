import { inject, injectable } from "inversify";
import { Api } from "@apis/api";
import type { HaproxySchema, HaproxySchemaField, HaproxySchemaFieldType, HaproxySchemaSectionName } from "@modules/config/config.types";

const FIELD_TYPES: HaproxySchemaFieldType[] = ["string", "number", "boolean", "enum", "complex"];

const SECTION_NAMES: HaproxySchemaSectionName[] = ["backend", "server", "default-server", "frontend", "bind"];

function asFieldType(value: unknown): HaproxySchemaFieldType {
	return FIELD_TYPES.find((type) => type === value) ?? "complex";
}

function ensureFields(value: unknown): HaproxySchemaField[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => entry as Record<string, unknown>)
		.filter((entry) => typeof entry?.name === "string")
		.map((entry) => ({
			name: entry.name as string,
			type: asFieldType(entry.type),
			enumValues: Array.isArray(entry.enumValues) ? entry.enumValues.filter((item): item is string => typeof item === "string") : [],
			writable: entry.writable !== false,
			reason: typeof entry.reason === "string" ? entry.reason : null,
		}));
}

@injectable()
export class SchemaService {
	constructor(@inject(Api) private readonly api: Api) {}

	async getSchema(): Promise<HaproxySchema> {
		const { data } = await this.api.axios.get(`${this.api.baseUrl}/schema`);
		const sections = Array.isArray(data?.sections) ? data.sections : [];

		return {
			sections: sections
				.map((section: Record<string, unknown>) => ({
					name: SECTION_NAMES.find((name) => name === section?.name),
					fields: ensureFields(section?.fields),
				}))
				.filter((section: { name?: HaproxySchemaSectionName }): section is { name: HaproxySchemaSectionName; fields: HaproxySchemaField[] } => Boolean(section.name)),
		};
	}
}
