import {Router} from "express";
import {arch, platform} from "os";

export const router = Router();

router.get("/test", (req, res) => {
    res.json({arch: arch(), platform: platform()})
})
