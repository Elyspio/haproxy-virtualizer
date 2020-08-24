import {Converter} from "../../assembler/converter";
import {Core} from "../types";
import {Helper} from "../../../util/helper";
import Backend = Core.Backend;
import Frontend = Core.Frontend;
import Config = Core.Config;
import Alteration = Core.Alteration;

export namespace WebAssembler {
    export namespace json {

        export const backend: Converter<Backend, Backend> = obj => {

            const regex: Alteration[] = obj.alter.map(r => ({
                condition: Helper.regexToString(r.condition as RegExp),
                thing: r.thing,
                change: {
                    from: Helper.regexToString(r.change.from as RegExp),
                    to: Helper.regexToString(r.change.to as RegExp),
                }
            }))

            return {
                ...obj,
                alter: regex
            }
        }

        export const frontend: Converter<Frontend, Frontend> = obj => {

            const backends = [];
            obj.backends.forEach(({condition, name}) => {
                backends.push({name, condition: Helper.regexToString(condition as RegExp)})
            })

            return {
                ...obj,
                backends
            }
        }

        export const config: Converter<Config, Config> = obj => {

            const frontend = {};
            const backend = {};

            Object.entries(obj.backends).forEach(([key, value]) => {
                backend[key] = WebAssembler.json.backend(value)
            })
            Object.entries(obj.frontends).forEach(([key, value]) => {
                frontend[key] = WebAssembler.json.frontend(value)
            })

            return {
                frontends: frontend,
                backends: backend
            }
        }
    }

    export namespace object {
        export const backend: Converter<Backend, Backend> = obj => {

            const regex: Alteration[] = obj.alter.map(r => ({
                condition: new RegExp(r.condition),
                thing: r.thing,
                change: {
                    from: new RegExp(r.change.from),
                    to: new RegExp(r.change.to),
                }
            }))

            return {
                ...obj,
                alter: regex
            }
        }

        export const frontend: Converter<Frontend, Frontend> = obj => {

            const backends = [];
            obj.backends.forEach(({condition, name}) => {
                backends.push({name, condition: new RegExp(condition)})
            })

            return {
                ...obj,
                backends
            }
        }

        export const config: Converter<Config, Config> = obj => {

            const frontend = {};
            const backend = {};

            Object.entries(obj.backends).forEach(([key, value]) => {
                backend[key] = WebAssembler.object.backend(value)
            })
            Object.entries(obj.frontends).forEach(([key, value]) => {
                frontend[key] = WebAssembler.object.frontend(value)
            })

            return {
                frontends: frontend,
                backends: backend
            }
        }
    }
}


