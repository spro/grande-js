"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Model = void 0;
const helpers_1 = require("./helpers");
const fields_1 = require("./fields");
const relationship_1 = require("./relationship");
const DEBUG = process.env.GRANDE_DEBUG || false;
const default_fields = ['id', 'created_at', 'updated_at'];
class Model {
    constructor(data) {
        Object.assign(this, this.publicFieldData(data));
    }
    publicFieldData(data) {
        const this_class = this.constructor;
        const public_data = {};
        Object.entries(data).map(([k, v]) => {
            const field_is_default = default_fields.indexOf(k) > 0;
            const field_exists = typeof this_class._fields[k] != 'undefined';
            const field_is_secret = field_exists && (this_class._fields[k].secret == true);
            if (field_is_default)
                public_data[k] = v;
            else if (!field_is_secret)
                public_data[k] = v;
        });
        return public_data;
    }
    static register(constructor) {
        Model._registered[constructor.name] = constructor;
    }
    static async table_exists() {
        const table_name = this._table;
        const class_name = this.name;
        const table_exists_query = `select exists (select table_name from information_schema.tables where table_name = '${table_name}');`;
        if (DEBUG)
            console.log('[table_exists_query]', table_exists_query);
        try {
            const result = await this._conn.query(table_exists_query);
            const exists = result.rows[0].exists;
            if (DEBUG)
                console.log('[exists]', exists);
            // return false
            return exists;
        }
        catch (err) {
            console.error(`[err] Error checking table exists for ${class_name}:`, err);
            return false;
        }
    }
    static create_table_sql(drop) {
        const table_name = this._table;
        const class_name = this.name;
        const field_defs = this._fields;
        field_defs['created_at'] = { type: 'timestamp', default: 'now()' };
        field_defs['updated_at'] = { type: 'timestamp' };
        const field_defs_sql = fields_1.make_field_defs_sql(field_defs);
        let create_table_query = '';
        if (drop)
            create_table_query += `drop table if exists ${table_name} cascade;\n`;
        create_table_query += `create table ${table_name} (\n    id serial primary key`;
        if (field_defs_sql.length > 0) {
            create_table_query += ',\n    ' + field_defs_sql;
        }
        create_table_query += '\n);';
        return create_table_query;
    }
    static async create_table(drop) {
        const table_name = this._table;
        const class_name = this.name;
        const create_table_query = this.create_table_sql(drop);
        try {
            // console.log(`\n* Creating table ${table_name} for ${class_name}`)
            await this._conn.query(create_table_query);
            // console.log(`** Created table ${table_name} for type ${class_name}`)
        }
        catch (err) {
            console.error(`[err] Error creating table ${table_name} for ${class_name}:`, err);
        }
    }
    static ensure_relationships() {
        Object.entries(this._relationships).map(([relationship_name, relationship_class]) => {
            if (relationship_class instanceof relationship_1.ReverseRelationship) {
                relationship_class.update_forward();
            }
        });
    }
    static async create_relationship_tables() {
        const create_promises = Object.entries(this._relationships).map(async ([relationship_name, relationship_class]) => {
            if (relationship_class instanceof relationship_1.Relationship) {
                await relationship_class.create_table(this._conn);
            }
        });
        await Promise.all(create_promises);
    }
    static create_relationship_tables_sql(drop) {
        const relationship_tables_sqls = Object.entries(this._relationships)
            .filter(([relationship_name, relationship_class]) => relationship_class instanceof relationship_1.Relationship)
            .map(([relationship_name, relationship_class]) => relationship_class.create_table_sql(drop));
        return relationship_tables_sqls.join('\n\n');
    }
    // Static CRUD methoods
    // -------------------------------------------------------------------------
    static async create(create_obj) {
        const defined_create_obj = helpers_1.defined(create_obj);
        const field_names = Object.keys(defined_create_obj);
        const field_values = Object.values(defined_create_obj);
        const placeholders = field_names.map((_, i) => '$' + (i + 1));
        const insert_query = `insert into ${this._table} (${field_names.join(', ')}) values (${placeholders.join(', ')}) returning *`;
        if (DEBUG)
            console.log('[create query]', insert_query, field_values);
        const result = await this._conn.query(insert_query, field_values);
        const instance = new this(result.rows[0]);
        return instance;
    }
    static async get(id) {
        const select_query = `select * from ${this._table} where id = $1`;
        if (DEBUG)
            console.log('[get query]', select_query, [id]);
        const result = await this._conn.query(select_query, [id]);
        if (result.rows.length == 0) {
            return null;
        }
        else {
            const instance = new this(result.rows[0]);
            return instance;
        }
    }
    static async find(query, options = {}) {
        let where_clause = "";
        if (Object.keys(query).length) {
            where_clause += "where ";
            for (let [key, value] of Object.entries(query)) {
                const where_value = `'${value}'`;
                where_clause += `${key} = ${where_value}`;
            }
        }
        let select_query = `select * from ${this._table} ${where_clause}`;
        if (options.limit) {
            select_query += ` limit ${options.limit}`;
        }
        if (DEBUG)
            console.log('[find query]', select_query);
        const result = await this._conn.query(select_query);
        return result.rows.map(row => new this(row));
    }
    static async find_one(query) {
        const all_results = await this.find(query, { limit: 1 });
        return all_results[0];
    }
    static async update(id, update_obj) {
        const defined_update_obj = helpers_1.defined(update_obj);
        const field_names = Object.keys(defined_update_obj);
        const field_values = Object.values(defined_update_obj);
        const set_fields = field_names.map((key, i) => `${key}=$${i + 1}`);
        set_fields.push('updated_at=now()'); // Set last updated
        const update_query = `update ${this._table} set ${set_fields.join(', ')} where id=${id} returning *`;
        if (DEBUG)
            console.log('[update query]', update_query, field_values);
        const result = await this._conn.query(update_query, field_values);
        const instance = new this(result.rows[0]);
        return instance;
    }
    async update(update_obj) {
        const this_class = this.constructor;
        return this_class.update(this.id, update_obj);
    }
    static async delete(id) {
        const table_name = this._table;
        const delete_query = `delete from ${table_name} where id=$1`;
        if (DEBUG)
            console.log('[delete query]', delete_query, [id]);
        await this._conn.query(delete_query, [id]);
        return { success: true };
    }
    async delete() {
        const this_class = this.constructor;
        return this_class.delete(this.id);
    }
    // Relationship CRUD methods
    // -------------------------------------------------------------------------
    async set_related(relationship_name, item, options) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        if (!singular) {
            throw new Error(`Can't use set() for ${this_class.name}'s non-singular ${relationship_class.kind == 'reverse' && 'reverse ' || ''}relationship ${relationship_name}`);
        }
        const field_names = [from_column, to_column];
        const placeholders = ['$1', '$2'];
        let this_column, related_column, related_id, field_values;
        if (relationship_class.kind == 'forward') {
            field_values = [this.id, item.id];
            this_column = from_column;
            related_column = to_column;
            related_id = item.id;
        }
        else {
            field_values = [item.id, this.id];
            this_column = to_column;
            related_column = from_column;
            related_id = item.id;
        }
        // Conflict resolution for constrained relationships
        // ---------------------------------------------------------------------
        // If the `replace` option is set, we will update existing relationships when conflicts arise.
        // For a forward to-one relationship, a conflict on the `from_` column means this relationship already exists. Instead of inserting a new row, the `to_` column of the existing row is updated.
        // A reverse to-one relationship is a forward *one-to* relationship. A conflict on the `to_` column means the relationship exists and the `from_` needs to be changed.
        let on_conflict;
        if (singular && options?.replace) {
            if (relationship_class.kind == 'forward') {
                on_conflict = `on conflict (${from_column}) do update set ${to_column} = ${item.id}`;
            }
            else if (relationship_class.kind == 'reverse') {
                on_conflict = `on conflict (${to_column}) do update set ${from_column} = ${item.id}`;
            }
        }
        const insert_query = `insert into ${relationship_table} (${field_names.join(', ')}) values (${placeholders.join(', ')}) ${on_conflict || ''}`;
        if (DEBUG)
            console.log('[set_related query]', insert_query, field_values);
        const result = await this_class._conn.query(insert_query, field_values);
    }
    async add_related(relationship_name, items) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        if (singular) {
            throw new Error(`Can't use add() for ${this_class.name}'s singular ${relationship_class.kind == 'reverse' && 'reverse ' || ''}relationship ${relationship_name}`);
        }
        const field_names = [from_column, to_column];
        let placeholder_sets = items.map((item, i) => `($${i * 2 + 1}, $${i * 2 + 2})`);
        let field_values;
        if (relationship_class.kind == 'forward') {
            const from_id = this.id;
            field_values = helpers_1.flatten(items.map((item) => [from_id, item.id]));
        }
        else {
            const to_id = this.id;
            field_values = helpers_1.flatten(items.map((item) => [item.id, to_id]));
        }
        const insert_query = `insert into ${relationship_table} (${field_names.join(', ')}) values ${placeholder_sets.join(', ')} returning *`;
        if (DEBUG)
            console.log('[add_related query]', insert_query, field_values);
        const result = await this_class._conn.query(insert_query, field_values);
        return result.rows;
    }
    async get_relationship(relationship_name) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        if (!singular) {
            throw new Error(`Can't use get() for ${this_class.name}'s non-singular ${relationship_class.kind == 'reverse' && 'reverse ' || ''}relationship ${relationship_name}`);
        }
        let this_column;
        if (relationship_class.kind == 'forward') {
            this_column = from_column;
        }
        else {
            this_column = to_column;
        }
        const select_query = `select * from ${relationship_table} where ${this_column} = $1`;
        if (DEBUG)
            console.log('[get_relationship query]', select_query, [this.id]);
        const result = await this_class._conn.query(select_query, [this.id]);
        return result.rows[0];
    }
    async get_related(relationship_name) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        let related_class;
        let related_column;
        if (relationship_class.kind == 'forward') {
            related_class = to_class;
            related_column = to_column;
        }
        else {
            related_class = from_class;
            related_column = from_column;
        }
        const result = await this.get_relationship(relationship_name);
        if (result != null) {
            return await related_class.get(result[related_column]);
        }
        else {
            return null;
        }
    }
    async find_related(relationship_name, options = {}) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        if (singular) {
            throw new Error(`Can't use find() for ${this_class.name}'s singular ${relationship_class.kind == 'reverse' && 'reverse ' || ''}relationship ${relationship_name}`);
        }
        let this_column;
        let related_class;
        let related_column;
        if (relationship_class.kind == 'forward') {
            this_column = from_column;
            related_class = to_class;
            related_column = to_column;
        }
        else {
            this_column = to_column;
            related_class = from_class;
            related_column = from_column;
        }
        const related_table = related_class._table;
        let select_query = `select ${related_table}.* from ${relationship_table} inner join ${related_table} on ${relationship_table}.${related_column} = ${related_table}.id  where ${this_column} = $1`;
        if (options.order) {
            select_query += ` order by ${options.order}`;
        }
        if (options.limit) {
            select_query += ` limit ${options.limit}`;
        }
        if (options.offset) {
            select_query += ` offset ${options.offset}`;
        }
        if (DEBUG)
            console.log('[find_related query]', select_query, [this.id]);
        const result = await this_class._conn.query(select_query, [this.id]);
        return result.rows.map((row) => new related_class(row));
    }
    async unset_related(relationship_name, item) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        if (!singular) {
            throw new Error(`Can't use unset() for ${this_class.name}'s non-singular ${relationship_class.kind == 'reverse' && 'reverse ' || ''}relationship ${relationship_name}`);
        }
        let this_column, related_column;
        if (relationship_class.kind == 'forward') {
            this_column = from_column;
            related_column = to_column;
        }
        else {
            this_column = to_column;
            related_column = from_column;
        }
        const delete_query = `delete from ${relationship_table} where ${this_column} = $1 and ${related_column} = $2`;
        if (DEBUG)
            console.log('[unset_related query]', delete_query, [this.id, item.id]);
        await this_class._conn.query(delete_query, [this.id, item.id]);
    }
    async remove_related(relationship_name, items) {
        const this_class = this.constructor;
        const relationship_class = this_class._relationships[relationship_name];
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details();
        if (!Array.isArray(items)) {
            throw new Error(`Must call remove() with array of items to remove`);
        }
        if (singular) {
            throw new Error(`Can't use remove() for ${this_class.name}'s singular ${relationship_class.kind == 'reverse' && 'reverse ' || ''}relationship ${relationship_name}`);
        }
        let this_column, related_column;
        if (relationship_class.kind == 'forward') {
            this_column = from_column;
            related_column = to_column;
        }
        else {
            this_column = to_column;
            related_column = from_column;
        }
        const item_ids = items.map((item) => item.id);
        const placeholders = items.map((_, i) => '$' + (i + 2)); // $1 is this_column's ID value
        const delete_query = `delete from ${relationship_table} where ${this_column} = $1 and ${related_column} in (${placeholders.join(', ')})`;
        if (DEBUG)
            console.log('[remove_related query]', delete_query, [this.id].concat(item_ids));
        await this_class._conn.query(delete_query, [this.id].concat(item_ids));
    }
}
exports.Model = Model;
Model._registered = {};
//# sourceMappingURL=model.js.map