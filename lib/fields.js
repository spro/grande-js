"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.make_field_defs_sql = exports.FieldDef = exports.type_pg_map = void 0;
const type_js_map = {
    'string': 'string',
    'int': 'number',
    'float': 'number',
    'timestamp': 'Date',
    'json': 'Object'
};
exports.type_pg_map = {
    'string': 'text',
    'int': 'int',
    'float': 'float',
    'timestamp': 'timestamp',
    'json': 'jsonb'
};
class FieldDef {
    constructor(type, options) {
        this.type = type;
        if (options != null) {
            Object.assign(this, options);
        }
    }
}
exports.FieldDef = FieldDef;
function make_field_defs_sql(fields) {
    const field_defs_sql = Object.entries(fields).map(([key, field_def]) => {
        const field_name = key;
        const field_type = (field_def.type in exports.type_pg_map) ? exports.type_pg_map[field_def.type] : field_def.type;
        let field_def_str = `${field_name} ${field_type}`;
        if (field_def.unique == true) {
            field_def_str += ' unique';
        }
        if (field_def.optional == false) {
            field_def_str += ' not null';
        }
        if (field_def.default != null) {
            field_def_str += ' default ' + field_def.default;
        }
        return field_def_str;
    });
    return field_defs_sql.length ? field_defs_sql.join(',\n    ') : '';
}
exports.make_field_defs_sql = make_field_defs_sql;
//# sourceMappingURL=fields.js.map