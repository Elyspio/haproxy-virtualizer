import E, {Express} from "express"
import {router} from "./routes/example";
import {handleError, middlewares} from "./middleware/middleware";
import {ArgumentParser} from 'argparse'
import path from "path";
import {logger} from "./util/logger";

const express = require('express');
export const app: Express = express();

app.use(...middlewares);
app.use('/example', router);

let frontPath = path.resolve(__dirname, "..", "front", "build");
logger.info("frontPath", {frontPath});
app.use("/", E.static(frontPath))


if (require.main === module) {
    const parser = new ArgumentParser();
    parser.addArgument("--port", {type: "int", defaultValue: 4000})
    const args: { port: number } = parser.parseArgs();

    app.listen(args.port, () => {
        console.log("Starting server on port", args.port);
    })
}

app.use(handleError);
