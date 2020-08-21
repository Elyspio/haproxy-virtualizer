export namespace Core {

    export interface Config {
        frontends: {
            [key in string]: Frontend
        },
        backends: {
            [key in string]: Backend
        }
    }


    type Mode = "http" | "tcp";

    export interface Frontend {
        mode: Mode
        bind: {
            host: string,
            port: number
        },
        backends: {
            name: string,
            condition?: RegExp | string
        }[]
    }

    export type Alteration = {
        thing: "url",
        change: {
            from: RegExp | string;
            to: RegExp | string
        }
        condition?: RegExp | string
    };

    export interface Backend {
        mode: Mode,

        alter?: Alteration[]

        server: {
            name: string,
            host: string,
            port: number,
            check: boolean
        }
    }

}




