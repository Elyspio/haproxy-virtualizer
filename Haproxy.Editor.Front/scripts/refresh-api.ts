import { generateApi } from "@elyspio/vite-eslint-config";
import * as path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..", "src", "core", "apis", "generated");
const swaggerUrl = process.env.SWAGGER_URL ?? "https://localhost:7252/swagger/v1/swagger.json";

await generateApi(swaggerUrl, projectRoot, "v1");
