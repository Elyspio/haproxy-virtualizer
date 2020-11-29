import {Configuration, Inject} from '@tsed/di';
import {$log, PlatformApplication} from '@tsed/common';
import * as path from 'path';
import {Helper} from "./util/helper";
import "@tsed/swagger"
import {middlewares} from "./middlewares/common/raw";

export const rootDir = __dirname;

let frontPath = Helper.isDev() ? path.resolve(__dirname, '..', '..', 'front', 'build') : path.resolve(__dirname, '..', 'front', 'build');
$log.info('frontPath', {frontPath, rootDir});

@Configuration({
    rootDir,
    acceptMimes: ['application/json'],
    httpPort: process.env.HTTP_PORT || 4000,
    httpsPort: false, // CHANGE
    mount: {
        '/core': [
            `${rootDir}/controllers/**/*.ts`
        ]
    },
    exclude: [
        '**/*.spec.ts'
    ],
    statics: {
        '/': [
            {root: frontPath}
        ]
    },
    swagger: [{
        path: "/swagger",
        specVersion: "3.0.1"
    }]

})
export class Server {

    @Inject()
    app: PlatformApplication;

    @Configuration()
    settings: Configuration;

    $beforeRoutesInit() {
        this.app.use(...middlewares);
        return null;
    }
}
