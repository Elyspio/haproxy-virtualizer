import {exec as _exec, ExecException} from "child_process";
import {$log} from '@tsed/common';

export namespace Helper {

    export const getMatchs = (str: string, regex: RegExp): string[] => {
        let regExpMatchArrays = str.matchAll(regex);
        let next = regExpMatchArrays.next();
        $log.info("next", {next});
        let val = next.value?.slice(1);

        if (val !== undefined) return val

        let last = regex.source.lastIndexOf(")");
        // @ts-ignore
        last = [...regex.source]
            .map((x: string, i) => ({data: x, index: i}))
            .filter((value) => value.data === ")" && value.index < last)
            .pop()
            ?.index;

        return getMatchs(str, new RegExp(regex.source.slice(0, last + 1), "g"))

    };
    export const regexToString = (regex: RegExp) => regex.source.replace(/\\\//g, "/")

    export type ExecReturn = {
        stdout: string,
        stderr: string,
        error: ExecException | null,
        code: number | null,
        signal: NodeJS.Signals | null
    }

    export const exec = (command: string): Promise<ExecReturn> => {
        return new Promise(resolve => {
            let c, s;
            _exec(command, (error, stdout, stderr) => {
                resolve({
                    stdout,
                    stderr,
                    error,
                    code: c,
                    signal: s
                })
            }).on("exit", (code, signal) => {
                $log.info("exit")
                c = code;
                s = signal;

            })
        })
    }

    export const isDev = () => process.env.NODE_ENV !== "production";
}
