import {HaproxyApi} from "./back";
import {getApiPath} from "../../view/config/api";

export const Apis = {
    haproxy: new HaproxyApi(undefined, getApiPath())
}
