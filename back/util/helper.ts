import {logger} from "./logger";
import {promisify} from "util";
import {exec as _exec} from "child_process";


export namespace Helper {
    export const getMatchs = (str: string, regex: RegExp): string[] => {
        let regExpMatchArrays = str.matchAll(regex);
        let next = regExpMatchArrays.next();
        logger.info("next", {next});
        let val = next.value?.slice(1);

        if (val !== undefined) return val

        let last = regex.source.lastIndexOf(")");
        last = [...regex.source]
            .map((x: string, i) => ({data: x, index: i}))
            .filter((value) => value.data === ")" && value.index < last)
            .pop()
            .index;

        return getMatchs(str, new RegExp(regex.source.slice(0, last + 1), "g"))

    };
    export const regexToString = (regex?: RegExp) => regex?.source.replace(/\\\//g, "/")

    export const exec = promisify(_exec)
}
