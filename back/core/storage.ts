import {promises} from "fs";
import * as path from "path";
import * as os from "os";

const {writeFile, readFile} = promises

export const filename = process.env.HAPROXY_PATH ?? "/etc/haproxy/haproxy.cfg"

export namespace Storage {


    export async function store(name: string = filename, data: string) {

        if (name[0] === "~") {
            name = path.join(os.homedir(), name.slice(1))
        }

        return writeFile(path.resolve(name), data);
    }

    export async function read(name: string = filename) {
        return (await readFile(name)).toString()
    }
}
