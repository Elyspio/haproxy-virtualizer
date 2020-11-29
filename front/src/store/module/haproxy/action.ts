import {createAction as _createAction} from "@reduxjs/toolkit";
import {Haproxy} from "../../../../../back/src/controllers/haproxy/types";

const createAction = <T>(name: string) => _createAction<T>(`theme/${name}`);


export const setConfig = createAction<Haproxy.Config>("setConfig")

export const frontendActions = {
    create: createAction<void>("createFrontend"),
    update: createAction<{ name: string, data: Haproxy.Frontend }>("updateFrontend"),
    remove: createAction<string>("removeFrontend"),
    removeBackend: createAction<string>("removeFrontendBackend")
}

export const backendActions = {
    create: createAction<void>("createBackend"),
    update: createAction<{ name: string, data: Haproxy.Backend }>("updateBackend"),
    remove: createAction<string>("removeBackend")
}
