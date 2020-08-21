import {Converter} from "../../assembler/converter";
import {Core} from "../types";
import Frontend = Core.Frontend;
import Backend = Core.Backend;
import {logger} from "../../../util/logger";
import {Helper} from "../../../util/helper";

export namespace External {


    export const extract: Converter<string, Core.Config> = str => {
        const lines = str.split("\n");

        const frontends: { [key in string]: Frontend } = {};
        const backends: { [key in string]: Backend } = {};

        const topLevelIndex = lines.reduce((prev, current, index) => {
            if (!current.startsWith("\t") && current.length) prev.push(index);
            return prev;
        }, [])

        topLevelIndex.forEach((index, indexInArray) => {
            const line = lines[index];
            if (line.startsWith("backend")) {
                const data = Backend.fromString(lines.slice(index, topLevelIndex[indexInArray + 1]))
                backends[data.name] = data.obj;
            }
            if (line.startsWith("frontend")) {
                const data = Frontend.fromString(lines.slice(index, topLevelIndex[indexInArray + 1]))
                frontends[data.name] = data.obj;
            }
        })

        return {
            backends,
            frontends
        };
    }

    export const convert: Converter<Core.Config, string> = (config) => {
        let str = defaultSetting;
        Object.entries(config.frontends).forEach(([key, val]) => {
            str += Frontend.toString(key, val)
        })
        Object.entries(config.backends).forEach(([key, val]) => {
            str += Backend.toString(key, val)
        })
        return str;
    }

    export namespace Frontend {
        export const toString = (name: string, {backends, bind, mode}: Frontend) => {
            let str = `frontend ${name}`
            str += `\n\tmode ${mode}\n\tbind ${bind.host}:${bind.port}`
            backends.forEach(back => {
                str += `\n\tuse_backend ${back.name}` + back.condition ? ` if { path -i -m beg ${back.condition.toString()} }` : ""
            })
            return str;
        }

        export const fromString: (lines: string[]) => { name: string, obj: Frontend } = (lines) => {
            let name = lines.filter(s => !s.startsWith("\t"))[0].split(" ")[1];
            let obj: Partial<Frontend> = {
                backends: []
            }

            lines.filter(s => s.startsWith("\t"))
                .map(l => l.slice(1))
                .forEach(line => {
                    const [key, val, ...next] = line.split(" ");

                    switch (key) {
                        case "mode":
                            obj.mode = val as any
                            break;

                        case "bind":
                            obj.bind = {
                                host: val.slice(0, val.indexOf(":")),
                                port: Number.parseInt(val.slice(val.indexOf(":")))
                            }
                            break;

                        case "use_backend":
                            const regex = /use_backend (.+) if { path -i -m beg (.+) }/g

                            const [name, condition] = Helper.getMatchs(line, regex);

                            const object: { name: string, condition?: RegExp } = {
                                name,
                                condition: new RegExp(condition)
                            }

                            obj.backends.push(object)

                            break;

                    }


                })
            return {name, obj: obj as Frontend}
        }
    }


    export  namespace Backend {
        import Alteration = Core.Alteration;
        export const toString = (name: string, {mode, server, alter}: Backend) => {
            let str = `backend ${name}`
            const strs = [
                `mode ${mode}`,
                `server ${server.name} ${server.host}:${server.port}` + (server.check ? " check" : "")
            ]

            alter?.forEach(conf => {
                strs.push(`http-request set-uri %[${conf.thing},regsub(${conf.change.from},${conf.change.to},)]` + conf.condition ? ` if { path -i -m beg ${conf.condition.toString()} }` : "")
            })


            return [str, strs].join("\n\t");
        }

        export const fromString: (lines: string[]) => { name: string, obj: Backend } = (lines) => {
            let name = lines.filter(s => !s.startsWith("\t"))[0].split(" ")[1];
            let obj: Partial<Backend> = {
                alter: []
            }

            lines.filter(s => s.startsWith("\t"))
                .map(l => l.slice(1))
                .forEach(line => {
                    const [key, val, ...next] = line.split(" ");

                    switch (key) {
                        case "mode":
                            obj.mode = val as any
                            break;

                        case "server":

                            const [host, port, check] = next.join(" ").replace(/(.*):([0-9])/, "$1 $2").split(" ")

                            obj.server = {
                                name: val,
                                check: check === "check",
                                host,
                                port: Number.parseInt(port)
                            }
                            break;

                        case "http-request":
                            let object: Alteration;

                            if (val === "set-uri") {
                                const regexStr = /%\[([a-z]+),regsub\((.*),(.*),\)] if { path -i -m beg (.*) }/g

                                const [thing, from, to, condition] =  Helper.getMatchs(next.join(" "), regexStr);
                                object = {
                                    thing: thing as any,
                                    change: {
                                        from: new RegExp(from),
                                        to: new RegExp(to)
                                    },
                                    condition: condition ? new RegExp(condition) : undefined,
                                }
                            }
                            obj.alter.push(object)

                            break;

                    }


                })
            return {name, obj: obj as Backend}
        }
    }
}

const defaultSetting = `
global
\tlog /dev/log\tlocal0
\tlog /dev/log\tlocal1 notice
\tchroot /var/lib/haproxy
\tstats socket /run/haproxy/admin.sock mode 660 level admin expose-fd listeners
\tstats timeout 30s
\tuser haproxy
\tgroup haproxy
\tdaemon

defaults
\tlog\tglobal
\tmode\thttp
\toption\thttplog
\toption\tdontlognull
        timeout connect 5000
        timeout client  50000
        timeout server  50000
\terrorfile 400 /etc/haproxy/errors/400.http
\terrorfile 403 /etc/haproxy/errors/403.http
\terrorfile 408 /etc/haproxy/errors/408.http
\terrorfile 500 /etc/haproxy/errors/500.http
\terrorfile 502 /etc/haproxy/errors/502.http
\terrorfile 503 /etc/haproxy/errors/503.http
\terrorfile 504 /etc/haproxy/errors/504.http
`