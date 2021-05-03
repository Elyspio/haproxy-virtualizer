import {AdditionalProperties, ArrayOf, CollectionOf, Integer, MapOf, Property, Required} from "@tsed/schema";


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
    redirect: boolean
}

class FrontendBind {
    @Property()
    @Required()
    host: string

    @Integer()
    @Required()
    port: number

    @Property()
    ssl?: string
}

class FrontendBack {
    @Property()
    @Required()
    name: string

    @Property()
    condition?: string
}


class Frontend {
    @Property()
    @Required()
    mode: Mode
    // ssl configuration for this frontend
    @Property(FrontendSsl)
    ssl?: FrontendSsl


    @CollectionOf(FrontendBind)
    @Required()
    bind: FrontendBind[]

    @Property(FrontendBack)
    @Required()
    backends: FrontendBack[]
}


class AlterationChanges {
    @Property()
    @Required()
    from: string

    @Property()
    @Required()
    to: string
}

class Alteration {
    @Property()
    @Required()
    thing: "url"

    @Property(AlterationChanges)
    @Required()
    change: AlterationChanges

    @Property()
    condition?: string
}


class BackendServer {
    @Property()
    @Required()
    name: string

    @Property()
    @Required()
    host: string

    @Integer()
    @Required()
    port: number

    @Property(Boolean)
    @Required()
    check: boolean
}


class Backend {
    @Property()
    @Required()
    mode: Mode

    @ArrayOf(Alteration)
    @Required()
    alter: Alteration[]

    @ArrayOf(BackendServer)
    @Required()
    server: BackendServer[]
}

export class ConfigModel {

    @MapOf(Frontend)
    @Required()
    frontends: Frontends

    @MapOf(Backend)
    @Required()
    backends: Backends
}

export class UploadBodyRequest {
    @Property(ConfigModel)
    @Required()
    config: ConfigModel
}
