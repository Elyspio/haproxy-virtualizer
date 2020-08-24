import {Interactor} from "./Interactor";
import {Core} from "../../../back/core/haproxy/types";

const isDev = process.env.NODE_ENV === "development"
export const base = isDev ? "http://localhost:4000/core" : `${window.location.href}/api`


export class HaproxyApi extends Interactor {
    constructor(endpoint: string) {
        super(endpoint);
    }

    private static _instance: HaproxyApi = new HaproxyApi(base);

    public static get instance() {
        return this._instance;
    }

    public async getConfig(): Promise<Core.Config> {
        return super.call("/", "GET")
    }
}
