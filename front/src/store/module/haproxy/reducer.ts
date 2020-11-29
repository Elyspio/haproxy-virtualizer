import {createReducer} from "@reduxjs/toolkit";
import {backendActions, frontendActions, setConfig} from "./action";
import {Haproxy} from "../../../../../back/src/controllers/haproxy/types";

export interface ConfigTheme {
    config: Haproxy.Config
}

const defaultState: ConfigTheme = {
    config: {
        backends: {},
        frontends: {}
    }
};

export const reducer = createReducer(defaultState, (builder) => {
    builder.addCase(setConfig, (state, action) => {
        state.config = action.payload;
    });

    // region backend

    builder.addCase(backendActions.create, (state) => {
        state.config.backends[""] = {
            server: {
                check: false,
                host: "",
                name: "",
                port: 0
            },
            alter: [],
            mode: "http"
        }
    })

    builder.addCase(backendActions.remove, (state, action) => {
        delete state.config.backends[action.payload];
    })

    builder.addCase(backendActions.update, (state, action) => {
        state.config.backends[action.payload.name] = action.payload.data
    })


    // endregion backend

    // region frontend

    builder.addCase(frontendActions.create, (state) => {
        state.config.frontends[""] = {
            backends: [],
            bind: [],
            mode: "http"
        }
    })

    builder.addCase(frontendActions.remove, (state, action) => {
        delete state.config.frontends[action.payload];
    })

    builder.addCase(frontendActions.removeBackend, (state, action) => {
        delete state.config.frontends[action.payload];
    })

    builder.addCase(frontendActions.update, (state, action) => {
        state.config.frontends[action.payload.name] = action.payload.data
    })

    // endregion frontend

});
