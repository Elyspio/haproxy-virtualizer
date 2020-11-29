export namespace Haproxy {

    export interface Config {

        frontends: {
            [key in string]: Frontend
        },
        backends: {
            [key in string]: Backend
        }
    }

    export type Mode = "http" | "tcp";

    export interface Frontend {
        mode: Mode
        // ssl configuration for this frontend
        ssl?: {
            // if true, redirect http over https
            redirect?: boolean
        },
        bind: {
            host: string,
            port: number
            // path to ssl certificate
            ssl?: string
        }[],
        backends: {
            name: string,
            condition?: RegExp | string
        }[]
    }

    export type Bind = Frontend["bind"][number]

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

        alter: Alteration[]

        server: {
            name: string,
            host: string,
            port: number,
            check: boolean
        }
    }
}
