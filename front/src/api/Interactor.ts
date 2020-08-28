type Method = "GET" | "POST" | "PUT" | "DELETE"


export class Interactor {

    private base: string


    constructor(endpoint: string) {
        this.base = endpoint
    }


    protected async get(url: string, urlParameters?: object, bodyParameters?: object) {
        return this.call(url, "GET", urlParameters, bodyParameters);
    }

    protected async post(url: string, urlParameters?: object, bodyParameters?: object) {
        return this.call(url, "POST", urlParameters, bodyParameters);
    }

    protected async put(url: string, urlParameters?: object, bodyParameters?: object) {
        return this.call(url, "PUT", urlParameters, bodyParameters);
    }

    private async call(url: string, method: Method, urlParameters?: object, bodyParameters?: object) {

        let urlSearchParams = ""
        let body: string | undefined;
        if (urlParameters) {
            urlSearchParams = `?${new URLSearchParams(Object.entries(urlParameters).map(([key, val]) => ([key, JSON.stringify(val)]))).toString()}`
        }
        if (bodyParameters) body = JSON.stringify(bodyParameters);

        return await fetch(`${this.base}${url}${urlSearchParams}`, {
            method,
            body,
            headers: {
                'Content-Type': 'application/json'
            },
        });
    }

}
