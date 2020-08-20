import express, {NextFunction} from "express"
import {logger} from "../util/logger";
import bodyParser from "body-parser";

const cors = require("cors");
export const middlewares: any[] = [];

let logRequest = (req: express.Request, res: express.Response, next: Function) => {
    logger?.log("request", undefined, {
        method: req.method,
        url: req.originalUrl,
        from: req.hostname,
        data: req.method === "get" ? req.params : req.body,
        accepts: req.accepts()
    })

    next();
};


function logResponseBody(req: express.Request, res: express.Response, next?: NextFunction) {
    const [oldWrite, oldEnd] = [res.write, res.end];
    const chunks: Buffer[] = [];

    (res.write as unknown) = function (chunk) {
        chunks.push(Buffer.from(chunk));
        (oldWrite as Function).apply(res, arguments);
    };

    res.end = function (chunk) {
        if (chunk) {
            chunks.push(Buffer.from(chunk));
        }
        let body = Buffer.concat(chunks).toString('utf8');

        if (body.length) {
            try {
                body = JSON.parse(body);
            } catch (e) {
                body = "NOT A JSON";
            }
        }

        logger.log("send", res.statusCode.toString(), {
            to: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            uri: req.url,
            data: body
        });
        (oldEnd as Function).apply(res, arguments);
    };
    if (next) {
        next();
    }
}

type Err = Error & { statusCode: number }


export function handleError(err: Err, req: express.Request, res: express.Response, next?: NextFunction) {
    logger.error("generic error", err)
    if (!err.statusCode) err.statusCode = 500; // If err has no specified error code, set error code to 'Internal Server Error (500)'
    res.status(500).json({
        status: "error",
        code: err.statusCode,
        message: err.message,
        name: err.name,
        stack: err.stack.split("\n"),
    });
    console.error(err);
}


middlewares.push(logRequest, logResponseBody)


middlewares.push(
    express.json(),
    bodyParser.urlencoded({extended: true}),
    cors()
)

