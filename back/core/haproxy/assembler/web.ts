import {Converter} from "../../assembler/converter";
import {Core} from "../types";
import Backend = Core.Backend;
import Frontend = Core.Frontend;

export namespace WebAssembler {
    export namespace Json {
        import Config = Core.Config;
        import Alteration = Core.Alteration;
        export const backend: Converter<Backend, Backend> = obj => {

            const regex: Alteration[] = obj.alter.map(r => ({
                condition: regexToString(r.condition as RegExp),
                thing: r.thing, change: {
                    from: regexToString(r.change.from as RegExp),
                    to: regexToString(r.change.to as RegExp),
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
                backends.push({name, condition: regexToString(condition as RegExp)})
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
                backend[key] = WebAssembler.Json.backend(value)
            })
            Object.entries(obj.frontends).forEach(([key, value]) => {
                frontend[key] = WebAssembler.Json.frontend(value)
            })

            return {
                frontends: frontend,
                backends: backend
            }
        }
    }
}


const regexToString = (regex?: RegExp) => regex?.source.replace(/\\\//g, "/")
