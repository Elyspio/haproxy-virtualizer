export namespace Helper {
    export const getMatchs = (str: string, regex: RegExp): string[] => str.matchAll(regex).next().value.slice(1);
    export const regexToString = (regex?: RegExp) => regex?.source.replace(/\\\//g, "/")
}
