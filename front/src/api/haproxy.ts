import {Interactor} from "./Interactor";
import {Haproxy} from "../../../back/src/controllers/haproxy/types";
import {getApiPath} from "../config/api";


export class HaproxyApi extends Interactor {

    private static _instance: HaproxyApi = new HaproxyApi(getApiPath("core/haproxy"));

    public static get instance() {
        return this._instance;
    }

    public async getConfig(): Promise<Haproxy.Config> {
        return await super.get("/").then(x => x.json())
    }

    public async setConfig(config: Haproxy.Config) {
        return super.post("/", undefined, {config})
    }

    public async download(config: Haproxy.Config) {
        const data = await super.post("/export", undefined, {config}).then(x => x.blob())
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'haproxy.cfg';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }


}
