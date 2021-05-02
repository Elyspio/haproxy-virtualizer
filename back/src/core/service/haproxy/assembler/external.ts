import {Haproxy} from "../../../../controllers/haproxy/types";
import {Converter} from '../../../assembler/converter';
import {Helper} from "../../../../util/helper";
import {$log} from "@tsed/common";
import Frontend = Haproxy.Frontend;
import Backend = Haproxy.Backend;

export namespace External {

    /**
     * Extract data from config file
     * @param str
     */
    export const extract: Converter<string, Haproxy.Config> = str => {
        const lines = str.split("\n");

        const frontends: { [key in string]: Frontend } = {};
        const backends: { [key in string]: Backend } = {};

        const topLevelIndex = lines.reduce((prev, current, index) => {
            if (!current.startsWith("\t") && current.length) prev.push(index);
            return prev;
        }, Array<number>())

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

    /**
     * Convert object to config file
     * @param config
     */
    export const convert: Converter<Haproxy.Config, string> = (config) => {
        let str = defaultSetting;
        str += "\n"

        Object.entries(config.frontends).forEach(([key, val]) => {
            str += Frontend.toString(key, val) + '\n\n'
        })

        str += "\n\n"

        Object.entries(config.backends).forEach(([key, val]) => {
            str += Backend.toString(key, val) + '\n\n'
        })
        return str;
    }

    export namespace Frontend {
        export const toString = (name: string, {backends, bind, mode, ssl}: Frontend) => {
            let str = `frontend ${name}`
            str += `\n\tmode ${mode}`

            bind.forEach(bind => {
                str += `\n\tbind ${bind.host}:${bind.port}`

                if (bind.ssl) {
                    str += ` ssl crt ${bind.ssl}`
                }
            })

            if (ssl) {
                if (ssl.redirect) {
                    str += `\n\thttp-request redirect scheme https unless { ssl_fc }`
                }
            }

            backends.forEach(back => {
                let end = back.condition ? ` if { path -i -m beg ${back.condition} }` : "";
                str += `\n\tuse_backend ${back.name}` + end
            })
            return str;
        }

        export const fromString: (lines: string[]) => { name: string, obj: Frontend } = (lines) => {
            let name = lines.filter(s => !s.startsWith("\t"))[0].split(" ")[1];
            let obj: Partial<Frontend> = {
                backends: [],
                bind: []
            }

            lines.filter(s => s.startsWith("\t"))
                .map(l => l.slice(1))
                .forEach(line => {
                    const [key, val] = line.split(" ");
                    let regex: RegExp;
                    switch (key) {
                        case "mode":
                            obj.mode = val as any
                            break;

                        case "http-request":
                            regex = /(redirect .* https unless { ssl_fc })/g
                            const result = Helper.getMatchs(line, regex);

                            if (result.length) {
                                obj.ssl = {
                                    redirect: true
                                }
                            }
                            break

                        case "bind":
                            regex = /bind (.*):([0-9]+) ssl crt (.*)/g
                            const [host, port, ssl] = Helper.getMatchs(line, regex);
                            obj.bind?.push({
                                host: host.trim(),
                                port: Number.parseInt(port),
                                ssl: ssl?.trim()
                            });
                            break;

                        case "use_backend":
                            regex = /use_backend (.+) if { path -i -m beg (.+) }/g

                            const [name, condition] = Helper.getMatchs(line, regex);

                            const object: { name: string, condition?: string } = {
                                name: name.trim(),
                                condition: condition?.trim()
                            }

                            obj.backends?.push(object)

                            break;

                    }


                })
            return {name, obj: obj as Frontend}
        }
    }


    export namespace Backend {
        import Alteration = Haproxy.Alteration;
        export const toString = (name: string, {mode, server, alter}: Backend) => {
            let str = `backend ${name}`
            const strs = [
                `mode ${mode}`,
                ...server.map(s => `server ${s.name} ${s.host}:${s.port}` + (s.check ? " check" : ""))
            ]

            alter?.forEach(conf => {
                const end = conf.condition ? ` if { path -i -m beg ${Helper.regexToString(new RegExp(conf.condition))} }` : "";
                strs.push(`http-request set-uri %[${conf.thing},regsub(${Helper.regexToString(new RegExp(conf.change.from ))},${Helper.regexToString(new RegExp(conf.change.to))},)]${end}`);
            })

            return [str, ...strs].join("\n\t");
        }

        export const fromString: (lines: string[]) => { name: string, obj: Backend } = (lines) => {
            let name = lines.filter(s => !s.startsWith("\t"))[0].split(" ")[1];
            let obj: Partial<Backend> = {
                alter: [],
                server: []
            }

            lines.filter(s => s.startsWith("\t") && !/[ \t]*#/g.test(s))
                .map(l => l.slice(1))
                .forEach(line => {
                    const [key, val, ...next] = line.split(" ");

                    switch (key) {
                        case "mode":
                            obj.mode = val as any
                            break;

                        case "server":
                            const [host, port, check] = next.join(" ").replace(/(.*):([0-9])/, "$1 $2").split(" ")
                            obj.server?.push({
                                name: val,
                                check: check === "check",
                                host,
                                port: Number.parseInt(port)
                            })
                            break;

                        case "http-request":
                            let object: Alteration | undefined = undefined;
                            const regexStr = /%\[([a-z]+),regsub\((.*),(.*),\)] if { path -i -m beg (.*) }/g
                            try {
                                if (val === "set-uri") {

                                    const [thing, from, to, condition] = Helper.getMatchs(next.join(" "), regexStr);

                                    object = {
                                        thing: thing as any,
                                        change: {
                                            from: Helper.regexToString(new RegExp(from)),
                                            to:Helper.regexToString( new RegExp(to))
                                        },
                                        condition: condition ? Helper.regexToString(new RegExp(condition)) : undefined,
                                    }
                                }

                                if (object) {
                                    obj.alter?.push(object)
                                }

                            } catch (e) {
                                $log.error(`Error for string:"${line}" regex: "${regexStr}"`)
                            }
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
\t\ttimeout connect 5000
\t\ttimeout client  50000
\t\ttimeout server  50000
\terrorfile 400 /etc/haproxy/errors/400.http
\terrorfile 403 /etc/haproxy/errors/403.http
\terrorfile 408 /etc/haproxy/errors/408.http
\terrorfile 500 /etc/haproxy/errors/500.http
\terrorfile 502 /etc/haproxy/errors/502.http
\terrorfile 503 /etc/haproxy/errors/503.http
\terrorfile 504 /etc/haproxy/errors/504.http
`
