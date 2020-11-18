const type_js_map = {
    'string': 'string',
    'int': 'number',
    'float': 'number',
    'timestamp': 'Date'
}

export const type_pg_map = {
    'string': 'text',
    'int': 'int',
    'float': 'float',
    'timestamp': 'timestamp'
}

export class FieldDef {
    type: string
    references_table?: string
    unique?: boolean
    optional?: boolean
    default?: string

    constructor(type: string, options?: {[key: string]: any}) {
        this.type = type
        if (options != null) {
            Object.assign(this, options)
        }
    }
}

export type FieldDefs = {[key: string]: FieldDef}

export function make_field_defs_str(fields: FieldDefs) {
    const field_defs_strs = Object.entries(fields).map(([key, field_def]) => {
        const field_name = key
        const field_type = (field_def.type in type_pg_map) ? type_pg_map[field_def.type] : field_def.type
        let field_def_str = `${field_name} ${field_type}`

        if (field_def.unique == true) {
            field_def_str += ' unique'
        }

        if (field_def.optional == false) {
            field_def_str += ' not null'
        }

        if (field_def.default != null) {
            field_def_str += ' default ' + field_def.default
        }

        return field_def_str
    })
    return field_defs_strs.length ? field_defs_strs.join(', \n    ') : ''
}


