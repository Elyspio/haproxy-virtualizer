import {Router} from "express";
import {filename, Storage} from "../core/storage";
import {External} from "../core/haproxy/assembler/external";
import {WebAssembler} from "../core/haproxy/assembler/web";
import {Save} from "./types";

export const router = Router();

/**
 * Retrieves data from /etc/haproxy/haproxy.cfg
 */
router.get("/", async (req, res) => {
    const config = await Storage.read();
    const obj = External.extract(config);
    res.json(WebAssembler.json.config(obj));
})


router.put("/", async (req: Save, res) => {
    const obj = WebAssembler.object.config(req.body.config)
    await Storage.store(filename, External.convert(obj))
    res.sendStatus(200);
})
