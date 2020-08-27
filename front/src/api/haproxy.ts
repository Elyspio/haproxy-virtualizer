import {Interactor} from "./Interactor";
import {Core} from "../../../back/core/haproxy/types";
import {base} from "../config/api";


export class HaproxyApi extends Interactor {

    private static _instance: HaproxyApi = new HaproxyApi(base);

    public static get instance() {
        return this._instance;
    }

    public async getConfig(): Promise<Core.Config> {
        return await super.get("/").then(x => x.json())
    }

    public async setConfig(config: Core.Config) {
        return super.post("/", undefined, {config})
    }

    public async download(config: Core.Config) {
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
