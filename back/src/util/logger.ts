import * as path from "path";
import * as fs from "fs"
import {createLogger, transport} from "winston";
import * as  dayjs from "dayjs";
import {platform} from "os";

Error.stackTraceLimit = 40;

const winston = require('winston');

export const logFolder = process.env.LOG_FOLDER ?? path.resolve(__dirname, "..", "..", "..", "logs");

const dateFormat = () => dayjs().format("DD/MM/YY -- HH:mm:ss")

const getLogFile = (...node: string[]) => path.join(logFolder, ...node)

const getFileNameAndLineNumber = () => {
    let stack = (new Error()).stack;
    let stackUsefull = stack!.split("\n").filter(str => !["node_modules", "internal"].some(s => str.includes(s)))
    let line: string | undefined;
    switch (platform()) {
        case "win32":
            line = stackUsefull.find(str => str.indexOf(":\\") !== -1 && !str.includes(path.join("util", "logger")))
            break;
        case "linux":
            line = stackUsefull.find(str => str.startsWith("/", 0) && !str.includes(path.join("util", "logger")))
            break;
    }

    if (!line) return undefined;

    const regex = /at (.*) .*\\(.*\.[jt]s):(.*):/g
    const regexWithoutFuncName = /at [A-Z]:\\.*\\([a-zA-Z]+.[jt]s):([0-9]+)/
    const matchWithFunctionName = Array.from(line!.matchAll(regex))[0];


    let str = "";

    if (matchWithFunctionName === undefined) {
        const match = Array.from(line!.matchAll(regexWithoutFuncName))[0];
        let infos = {
            filename: match[1],
            line: match[2]
        }
        str = `${infos.filename} (${infos.line})`;
    } else {
        let infos = {
            func: matchWithFunctionName[1],
            filename: matchWithFunctionName[2],
            line: matchWithFunctionName[3]
        }

        str = `${infos.filename} (${infos.line})`;

        if (!infos.func.includes("anonymous")) {
            str += ` at ${infos.func}`
        }

    }
    return str;
};

const getFormat = () => {

    return winston.format.combine(
        winston.format.metadata({fillExcept: ['message', 'level']}),
        winston.format.printf((info) => {

            let callInfos
            if (!["send", "request"].includes(info.level)) {
                callInfos = getFileNameAndLineNumber()
            }

            const timestamp = dateFormat();
            const objs = Object.keys(info.metadata);

            const objsStr = objs.reduce((acc, now) => {
                return info.metadata[now] ? `${acc} ${now}=${JSON.stringify(info.metadata[now])}` : acc;
            }, "")

            let end: string = "";

            if (info.message) {
                end += info.message.trim();
            }

            if (end.length > 0) {
                end += ' |'
            }

            if (objsStr.length > 0) {
                end += `${objsStr}`
            }

            return `${timestamp} | ${info.level.toLocaleUpperCase().padEnd(7, " ")} | ${end} ${callInfos ? ` | ${callInfos}` : ""}`
        }))
};

function getTransports(service: string): transport[] {
    const transports: transport[] = [];
    const format = getFormat()
    let logPath = path.join(logFolder, service);

    if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, {recursive: true});
    }
    const day = dayjs().format("DD-MM-YYYY")

    transports.push(
        new winston.transports.File({
            filename: getLogFile(service, day, 'combined.log'),
            format
        }),

        new winston.transports.File({
            filename: getLogFile(service, day, 'error.log'),
            level: "error",
            format,
        }),

        new winston.transports.File({
            filename: getLogFile(service, day, 'request.log'),
            level: "request",
            format,
        }),
    )

    transports.push(
        new winston.transports.Console({format})
    )

    return transports;
}


export const loggerConfig = {
    levels: {
        send: 5,
        request: 4,
        debug: 3,
        info: 2,
        warning: 1,
        error: 0,
    },
    transports: getTransports("server"),
    level: "send"
}
export const logger = createLogger(loggerConfig)
