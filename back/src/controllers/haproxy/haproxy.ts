import {BodyParams, Controller, Get, Post, Req, Res, UseBefore} from "@tsed/common";
import {Services} from "../../core/service";
import {Returns} from "@tsed/schema";
import {RequireLogin, UnauthorizedModel} from "../../middlewares/authentication";
import {files} from "../../core/service/storage";
import {ConfigModel, UploadBodyRequest} from "./models";
import * as  Express from "express"

@Controller("/haproxy")
export class Haproxy {

    @Post("/")
    @UseBefore(RequireLogin)
    @Returns(401, UnauthorizedModel)
    @Returns(200, ConfigModel)
    async post(@BodyParams("config") config: ConfigModel) {
        const obj = Services.haproxy.converter.web.object.config(config)
        await Services.storage.store(files.haproxy, Services.haproxy.converter.external.convert(obj))
    }

    @Get("/")
    @Returns(200, ConfigModel)
    async get(@Res() res) {
        const config = await Services.storage.read(files.haproxy);
        console.log(config);
        const obj = Services.haproxy.converter.external.extract(config);
        res.json(Services.haproxy.converter.web.json.config(obj));
    }

    @Post("/export")
    @Returns(200, String)
    async postExport(@Res() res: Express.Response, @BodyParams() body: UploadBodyRequest) {
        const obj = Services.haproxy.converter.web.object.config(body.config)
        res.json(Services.haproxy.converter.external.convert(obj));
    }

}
