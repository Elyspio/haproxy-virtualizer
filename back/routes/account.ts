import {Router} from "express";
import {files,  Storage} from "../core/storage";
import {Authorization, Save} from "./types";
import {Account, Accounts} from "../core/account/types";
export const router = Router();



router.post("/authorized", async (req: Authorization, res) => {
    const hash = req.body.hash;
    const accounts: Accounts = JSON.parse(await Storage.read(files.account));

    if (accounts.some(acc =>  acc ===  hash)) res.sendStatus(200)

    res.sendStatus(403);
})

