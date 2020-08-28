import {promises} from "fs";
import * as path from "path";
import * as os from "os";

const {writeFile, readFile} = promises

export const files = {
    haproxy: process.env.HAPROXY_PATH ?? "/etc/haproxy/haproxy.cfg",
    account: process.env.ACCOUNT_PATH ?? "/app/accounts.json"
}

export namespace Storage {


    export async function store(name: string, data: string) {

        if (name[0] === "~") {
            name = path.join(os.homedir(), name.slice(1))
        }

        return writeFile(path.resolve(name), data);
    }

    export async function read(name: string) {
        return (await readFile(name)).toString()
    }
}
