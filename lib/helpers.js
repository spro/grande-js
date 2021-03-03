"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defined = exports.flatten = void 0;
function flatten(arrs) {
    let flat = [];
    for (const arr of arrs) {
        for (const item of arr) {
            flat.push(item);
        }
    }
    return flat;
}
exports.flatten = flatten;
function defined(o) {
    let o_ = {};
    Object.entries(o).map(([k, v]) => {
        if (typeof v != 'undefined') {
            o_[k] = v;
        }
    });
    return o_;
}
exports.defined = defined;
//# sourceMappingURL=helpers.js.map