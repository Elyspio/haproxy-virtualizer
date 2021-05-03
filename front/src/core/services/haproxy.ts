import {Haproxy} from "../../../../back/src/web/controllers/haproxy/types";
import {Apis} from "../apis";

export class HaproxyService {

    public async download(config: Haproxy.Config) {
        const data = Apis.haproxy.haproxyPostExport({config})
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

    async getConfig() {
        return await Apis.haproxy.haproxyGet().then(x => x.data);
    }

    async setConfig(config: Haproxy.Config) {
        await Apis.haproxy.haproxyPost({config: config})
    }
}
