import {Interactor} from "./Interactor";
import {getApiPath} from "../config/api";
import md5 from "md5"
import {Account} from "../../../back/core/account/types";

export class AccountApi extends Interactor {

    private static _instance: AccountApi = new AccountApi(getApiPath("account"));

    public static get instance() {
        return this._instance;
    }


    public async isAuthorized({name, password}: Account): Promise<boolean> {
        const hash = md5(name + password)
        try {
            const res = await super.post("/authorized", undefined,{hash});
            if (res.status === 200) return true;
        }
        catch (e) {
        }
        return false;
    }


}
