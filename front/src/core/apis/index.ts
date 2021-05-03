import {HaproxyApi} from "./back";


let backendHost = process.env.NODE_ENV === "development"
    ? "http://localhost:4000"
    : window.location.origin + window.location.pathname


function removeTrailingSlash(path: string) {
    if (path[path.length - 1] === "/") path = path.slice(0, path.length - 1)
    return path;
}

backendHost = removeTrailingSlash(backendHost);

console.log("Backend host", backendHost);

export const Apis = {
    haproxy: new HaproxyApi(undefined, backendHost)
}
