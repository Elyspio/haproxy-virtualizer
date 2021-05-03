import * as path from "path";
import {Configuration} from "@tsed/di";
import {$log} from "@tsed/common";

export const getEnv = (env: string, fallback) => {
    return process.env[env] ?? fallback;
}

const rootDir = path.resolve(__dirname, "..")
let frontPath = process.env.FRONT_PATH ?? path.resolve(rootDir, "..", "..", "front", "build")

$log.debug({frontPath})

export const webConfig: Partial<Configuration> = {
    rootDir,
    httpPort: getEnv("OWN_PORT", 4000),
    httpsPort: false, // CHANGE
    mount: {
        "/api": [
            `${rootDir}/web/controllers/**/*`
        ]
    },
    statics: {
        '/': [
            {root: frontPath}
        ]
    },
    exclude: [
        "**/*.spec.ts"
    ],
    swagger: [{
        path: "/swagger",
    }],

}
