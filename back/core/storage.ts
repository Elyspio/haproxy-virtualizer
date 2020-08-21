import {promises, readFileSync} from "fs";

const {writeFile, readFile} = promises

export const filename = process.env.HAPROXY_PATH ?? "/etc/haproxy/haproxy.cfg"

export namespace Storage {


    export async function store(name: string = filename, data: string) {
        return writeFile(name, data);
    }

    export async function read(name: string = filename) {
        return (await readFileSync(name)).toString()
    }
}
