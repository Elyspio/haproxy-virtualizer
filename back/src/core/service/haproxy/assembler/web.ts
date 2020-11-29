import {Haproxy} from "../../../../controllers/haproxy/types";
import Backend = Haproxy.Backend;
import Frontend = Haproxy.Frontend;
import Config = Haproxy.Config;
import Alteration = Haproxy.Alteration;
import {Converter} from "../../../assembler/converter";
import {Helper} from "../../../../util/helper";

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

            const backends = Array<{name: string, condition: string}>();
            obj.backends.forEach(({condition, name}) => {
                backends.push({name, condition: Helper.regexToString(condition as RegExp)})
            })

            return {
                ...obj,
                backends
            }
        }

        export const config: Converter<Config, Config> = obj => {

            const config: Config = {backends: {}, frontends: {}}

            Object.entries(obj.backends).forEach(([key, value]) => {
                config.backends[key] = WebAssembler.json.backend(value)
            })
            Object.entries(obj.frontends).forEach(([key, value]) => {
                config.frontends[key] = WebAssembler.json.frontend(value)
            })

            return config
        }
    }

    export namespace object {
        export const backend: Converter<Backend, Backend> = obj => {

            const regex: Alteration[] = obj.alter.map(r => ({
                condition: r.condition ?  new RegExp(r.condition) : undefined,
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

            const backends = Array<{name: string, condition: string}>();
            obj.backends.forEach(({condition, name}) => {
                backends.push({name, condition: Helper.regexToString(condition as RegExp)})
            })

            return {
                ...obj,
                backends
            }
        }

        export const config: Converter<Config, Config> = obj => {

            const config: Config = {backends: {}, frontends: {}}


            Object.entries(obj.backends).forEach(([key, value]) => {
                config.backends[key] = WebAssembler.object.backend(value)
            })
            Object.entries(obj.frontends).forEach(([key, value]) => {
                config.frontends[key] = WebAssembler.object.frontend(value)
            })

            return config

        }
    }
}


