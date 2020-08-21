import {Router} from "express";
import {Storage} from "../core/storage";
import {External} from "../core/haproxy/assembler/external";
import {logger} from "../util/logger";
import {WebAssembler} from "../core/haproxy/assembler/web";

export const router = Router();

router.get("/test", async (req, res) => {
    const config = await Storage.read();
    const obj = External.extract(config);
    res.json(WebAssembler.Json.config(obj));
})
