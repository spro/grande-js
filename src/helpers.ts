export function flatten(arrs) {
    let flat = []
    for (const arr of arrs) {
        for (const item of arr) {
            flat.push(item)
        }
    }
    return flat
}
