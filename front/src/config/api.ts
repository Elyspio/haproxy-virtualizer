const isDev = process.env.NODE_ENV === "development"

export let base = "http://localhost:4000/core"

if(!isDev) {

    base = `${window.location.origin}${window.location.pathname}`

    if(base[base.length-1] !== "/") base += "/"

    base += "core"

}
