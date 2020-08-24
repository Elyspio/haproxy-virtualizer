type Method = "GET" | "POST" | "PUT" | "DELETE"


export class Interactor {

    private base: string


    constructor(endpoint: string) {
        this.base = endpoint
    }

    protected async call(url: string, method: Method, args?: object) {

        let urlSearchParams = ""
        let body: string | undefined;
        if (args) {
            if (method === "GET" && args) urlSearchParams = `?${new URLSearchParams(Object.entries(args)).toString()}`
            if (method !== "GET" && args) {
                body = JSON.stringify(args);
            }
        }


        const data = await fetch(`${this.base}/${url}${urlSearchParams}`, {
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
