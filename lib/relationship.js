"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverseRelationship = exports.ToOneRelationship = exports.ToManyRelationship = exports.Relationship = exports.make_foreign_keys_str = void 0;
const fields_1 = require("./fields");
const model_1 = require("./model");
const DEBUG = process.env.GRANDE_DEBUG || false;
function make_foreign_keys_str(fields) {
    const foreign_keys_keys = '';
    let foreign_keys_strs = [];
    const field_names = Object.entries(fields).map(([key, field_def]) => key);
    foreign_keys_strs.push(`primary key (${field_names.join(', ')})`);
    foreign_keys_strs = foreign_keys_strs.concat(Object.entries(fields).map(([key, field_def]) => {
        const field_name = key;
        const field_type = (field_def.type in fields_1.type_pg_map) ? fields_1.type_pg_map[field_def.type] : field_def.type;
        let field_def_str = `foreign key (${field_name}) references ${field_def.references_table} (id)`;
        if (field_def.unique == true) {
            field_def_str += ' unique';
        }
        if (field_def.optional == false) {
            field_def_str += ' not null';
        }
        return field_def_str;
    }));
    let foreign_keys_str = foreign_keys_strs.length ? foreign_keys_strs.join(',\n    ') : '';
    return foreign_keys_str;
}
exports.make_foreign_keys_str = make_foreign_keys_str;
// Main relationship class
// -------------------------------------------------------------------------
class Relationship {
    from_model_name;
    to_model_name;
    relationship_name;
    relationship_extra;
    // For super-class
    static _registered = {};
    kind = 'forward';
    singular = false;
    reverse;
    constructor(from_model_name, to_model_name, relationship_name, relationship_extra) {
        this.from_model_name = from_model_name;
        this.to_model_name = to_model_name;
        this.relationship_name = relationship_name;
        this.relationship_extra = relationship_extra;
        const relationship_key = from_model_name + '__' + relationship_name;
        Relationship._registered[relationship_key] = this;
    }
    create_table_sql(drop) {
        const from_model = model_1.Model._registered[this.from_model_name];
        const to_model = model_1.Model._registered[this.to_model_name];
        const table_name = `${from_model._table}_${this.relationship_name}`;
        // console.log(`\n* Create relationship table ${table_name}`)
        let relationship_fields = {};
        const from_column = `from_${from_model._table}_id`;
        const to_column = `to_${to_model._table}_id`;
        relationship_fields[from_column] = { references_table: from_model._table, type: 'int' };
        relationship_fields[to_column] = { references_table: to_model._table, type: 'int' };
        const foreign_keys_str = make_foreign_keys_str(relationship_fields);
        relationship_fields['created_at'] = { type: 'timestamp', default: 'now()' };
        const field_defs_sql = (0, fields_1.make_field_defs_sql)(relationship_fields);
        // Define uniqueness constraints
        let unique_keys_str;
        // To-one (singular - from ID is unique)
        if (this.singular) {
            unique_keys_str = `unique (${from_column})`;
            // One to one (both from and to IDs are unique)
            if (this.reverse && this.reverse.singular) {
                unique_keys_str += `, unique (${to_column})`;
            }
        }
        // One-to-many (reverse is singular - to ID is unique)
        else if (this.reverse && this.reverse.singular) {
            unique_keys_str = `unique (${to_column})`;
        }
        // Many-to-many (the pair of IDs is unique)
        else {
            unique_keys_str = `unique (${from_column}, ${to_column})`;
        }
        let create_table_query = '';
        if (drop)
            create_table_query = `drop table if exists ${table_name} cascade;\n`;
        create_table_query += `create table ${table_name} (
    ${field_defs_sql},
    ${foreign_keys_str},
    ${unique_keys_str}
);
`;
        return create_table_query;
    }
    async create_table(pool, drop = false) {
        const from_model = model_1.Model._registered[this.from_model_name];
        const to_model = model_1.Model._registered[this.to_model_name];
        const table_name = `${from_model._table}_${this.relationship_name}`;
        // console.log(`\n* Create relationship table ${table_name}`)
        const create_table_query = this.create_table_sql(drop);
        try {
            // console.log(`** Creating relationship table ${table_name}`)
            await pool.query(create_table_query);
            // console.log(`** Created relationship table ${table_name}`)
        }
        catch (err) {
            console.error(`[err] Error creating relationship table ${table_name}:`, err);
        }
    }
    get_details() {
        const from_class = model_1.Model._registered[this.from_model_name];
        const to_class = model_1.Model._registered[this.to_model_name];
        const from_table = from_class._table;
        const to_table = to_class._table;
        const from_column = `from_${from_table}_id`;
        const to_column = `to_${to_table}_id`;
        const relationship_table = `${from_table}_${this.relationship_name}`;
        const relationship_key = this.from_model_name + '__' + this.relationship_name;
        const this_class = Relationship._registered[relationship_key];
        const singular = this_class.singular;
        return [from_class, to_class, from_column, to_column, relationship_table, singular];
    }
}
exports.Relationship = Relationship;
class ToManyRelationship extends Relationship {
    singular = false;
}
exports.ToManyRelationship = ToManyRelationship;
class ToOneRelationship extends Relationship {
    singular = true;
}
exports.ToOneRelationship = ToOneRelationship;
class ReverseRelationship {
    reverse_model_name;
    reverse_relationship_name;
    singular;
    kind = 'reverse';
    // from_model_name: string
    // to_model_name: string
    constructor(reverse_model_name, reverse_relationship_name, singular = false) {
        this.reverse_model_name = reverse_model_name;
        this.reverse_relationship_name = reverse_relationship_name;
        this.singular = singular;
    }
    update_forward() {
        const relationship_key = this.reverse_model_name + '__' + this.reverse_relationship_name;
        const forward_relationship = Relationship._registered[relationship_key];
        if (!forward_relationship) {
            throw `Could not find forward relationship for reverse ${this.reverse_relationship_name}`;
        }
        forward_relationship.reverse = this;
    }
    get_details() {
        const relationship_key = this.reverse_model_name + '__' + this.reverse_relationship_name;
        const forward_relationship = Relationship._registered[relationship_key];
        const from_class = model_1.Model._registered[forward_relationship.from_model_name];
        const to_class = model_1.Model._registered[forward_relationship.to_model_name];
        const from_table = from_class._table;
        const to_table = to_class._table;
        const from_column = `from_${from_table}_id`;
        const to_column = `to_${to_table}_id`;
        const relationship_table = `${from_table}_${this.reverse_relationship_name}`;
        const singular = this.singular;
        return [from_class, to_class, from_column, to_column, relationship_table, singular];
    }
}
exports.ReverseRelationship = ReverseRelationship;
//# sourceMappingURL=relationship.js.map