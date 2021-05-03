import {Configuration, Inject} from '@tsed/di';
import {PlatformApplication} from '@tsed/common';
import "@tsed/swagger"
import {middlewares} from "./web/middlewares/common/raw";
import {webConfig} from "./config/web";

export const rootDir = __dirname;

@Configuration(webConfig)
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
