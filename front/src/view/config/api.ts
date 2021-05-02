const isDev = process.env.NODE_ENV === "development"


export function getApiPath(api?: string, useProduction?: boolean) {
    let base = `http://localhost:4000${api ?? ""}`

    if (!isDev || useProduction) {
        base = `${window.location.origin}${window.location.pathname}`
        base += (api ?? "")
    }

    if (base[base.length - 1] === "/") base = base.slice(0, base.length - 1)

    return base;
}

