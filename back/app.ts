import E, {Express} from "express"
import {router as haproxy} from "./routes/haproxy";
import {router as account} from "./routes/account";
import {handleError, middlewares} from "./middleware/middleware";
import {ArgumentParser} from 'argparse'
import path from "path";
import {logger} from "./util/logger";

const express = require('express');
export const app: Express = express();

app.use(...middlewares);
app.use('/core', haproxy);
app.use('/account', account);

let frontPath = path.resolve(__dirname, "..", "front", "build");
logger.info("frontPath", {frontPath});
app.use("/", E.static(frontPath))


if (require.main === module) {
    const parser = new ArgumentParser();
    parser.addArgument("--port", {type: "int", defaultValue: 4000})
    const args: { port: number } = parser.parseArgs();

    app.listen(args.port, () => {
        logger.info(`Starting server on port ${args.port}`);
    })
}

app.use(handleError);
