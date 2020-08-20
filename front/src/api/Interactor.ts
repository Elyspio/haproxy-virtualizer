import {base} from "../config/api";


type Method = "GET" | "POST" | "PUT" | "DELETE"


export class Interactor {

    private static _instance: Interactor = new Interactor();

    public static get instance() {
        return Interactor._instance;
    }

    public get test(): Promise<object> {
        return new Promise(async resolve => {
            resolve(this.call("example/test", "GET"))
        })
    }

    private async call(url: string, method: Method, args?: object) {

        let urlSearchParams = ""
        let body: string | undefined;
        if(args) {
            if (method === "GET" && args) urlSearchParams = `?${new URLSearchParams(Object.entries(args)).toString()}`
            if (method !== "GET" && args) {
                body = JSON.stringify(args);
            }
        }


        const data = await fetch(`${base}/${url}${urlSearchParams}`, {
            method,
            body,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
        }).then(raw => raw.json());
        return data;
    }

}
