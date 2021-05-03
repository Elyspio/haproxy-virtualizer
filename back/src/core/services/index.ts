import {AuthenticationService} from "./authentication"
import {StorageService} from "./storage";
import {HaproxyService} from "./haproxy/haproxy";


export const Services = {
    haproxy: new HaproxyService(),
    authentication: new AuthenticationService(),
    storage: new StorageService()
}
