
export type AnyDict = {
    [key: string]: any
}

export function flatten(arrs: any[]) {
    let flat: any[] = []
    for (const arr of arrs) {
        for (const item of arr) {
            flat.push(item)
        }
    }
    return flat
}

export function defined(o) {
    let o_ = {}
    Object.entries(o).map(([k, v]) => {
        if (typeof v != 'undefined') {
            o_[k] = v
        }
    })
    return o_
}
