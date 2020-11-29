import {AdditionalProperties, Any, CollectionOf, Enum, Integer, Property} from "@tsed/schema";


class Frontends {
    [key: string]: Frontend;
}

@AdditionalProperties(true)
class Backends {

    [key: string]: Backend;
}


type Mode = "http" | "tcp";


class FrontendSsl {
    @Property(Boolean)
    redirect
}

class FrontendBind {
    @Property()
    host: string
    @Integer()
    port: number
    @Property()
        // path to ssl certificate
    ssl?: string
}

class FrontendBack {
    @Property()
    name: string

    @Any(RegExp, String)
    condition?: RegExp | string
}


class Frontend {
    @Enum("http", "tcp")
    mode: Mode
    // ssl configuration for this frontend
    @Property(FrontendSsl)
    ssl?: FrontendSsl


    @CollectionOf(FrontendBind)
    bind: FrontendBind[]

    @Property(FrontendBack)
    backends: FrontendBack[]
}


class AlterationChanges {
    @Any(RegExp, String)
    from: RegExp | string

    @Any(RegExp, String)
    to: RegExp | string
}

class Alteration {
    @Enum("url")
    thing: "url"
    @Property(AlterationChanges)
    change: AlterationChanges

    @Any(RegExp, String)
    condition?: RegExp | string
}


class BackendServer {
    @Property()
    name: string
    @Property()
    host: string

    @Integer()
    port: number

    @Property(Boolean)
    check: boolean
}

class Backend {
    mode: Mode

    @CollectionOf(Alteration)
    alter: Alteration[]

    @Property(BackendServer)
    server: BackendServer
}

export class ConfigModel {

    @CollectionOf(Frontend)
    frontends: Frontends

    @CollectionOf(Backend)
    backends: Backends
}

