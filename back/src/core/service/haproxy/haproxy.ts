import {External} from "./assembler/external";
import {WebAssembler} from "./assembler/web";

export class HaproxyService {
    public converter = {
        external: External,
        web: WebAssembler
    }
}
