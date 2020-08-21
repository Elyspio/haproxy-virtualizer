import {logger} from "./logger";

export namespace Helper {
    export const getMatchs = (str: string, regex: RegExp): string[] => str.matchAll(regex).next().value.slice(1);
}
