import { Container } from "inversify";
import { AuthService } from "@services/auth.service";
import { ConfigService } from "@services/config.service";
import { DashboardService } from "@services/dashboard.service";
import { SchemaService } from "@services/schema.service";

export function addDiServices(container: Container) {
	container.bind(AuthService).toSelf();
	container.bind(ConfigService).toSelf();
	container.bind(DashboardService).toSelf();
	container.bind(SchemaService).toSelf();
}
