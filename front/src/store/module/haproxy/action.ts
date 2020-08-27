import {createAction as _createAction} from "@reduxjs/toolkit";
import {Core} from "../../../../../back/core/haproxy/types";

const createAction = <T>(name: string) => _createAction<T>(`theme/${name}`);


export const setConfig = createAction<Core.Config>("setConfig")

export const frontendActions = {
    create: createAction<void>("createFrontend"),
    update: createAction<{ name: string, data: Core.Frontend }>("updateFrontend"),
    remove: createAction<string>("removeFrontend"),
    removeBackend: createAction<string>("removeFrontendBackend")
}

export const backendActions = {
    create: createAction<void>("createBackend"),
    update: createAction<{ name: string, data: Core.Backend }>("updateBackend"),
    remove: createAction<string>("removeBackend")
}
