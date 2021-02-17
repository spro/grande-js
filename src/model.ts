import * as pg from 'pg'

import {AnyDict, flatten, defined} from './helpers'
import {FieldDefs, make_field_defs_sql} from './fields'
import {Relationship, ReverseRelationship, AnyRelationship} from './relationship'

// Supporting types & classes

type Query = AnyDict
// TODO: More specifics
type QueryOptions = AnyDict

// Main model class
// -----------------------------------------------------------------------------

type ModelRef = typeof Model

const default_fields = ['id', 'created_at', 'updated_at']

export class Model {
    // For Model super-class
    static _conn: pg.PoolClient
    static _registered: {[key: string]: ModelRef} = {}

    // Per Model sub-class
    static _table: string
    static _fields: FieldDefs
    static _relationships: {[key: string]: AnyRelationship}

    id: number

    constructor(data: any) {
        Object.assign(this, this.publicFieldData(data))
    }

    publicFieldData(data: any) {
        const this_class = (this.constructor as typeof Model)
        const public_data = {}
        Object.entries(data).map(([k, v]) => {
            const field_is_default = default_fields.indexOf(k) > 0
            const field_exists = typeof this_class._fields[k] != 'undefined'
            const field_is_secret = field_exists && (this_class._fields[k].secret == true)
            if (field_is_default)
                public_data[k] = v
            else if (!field_is_secret)
                public_data[k] = v
        })
        return public_data
    }

    static register(constructor: ModelRef) {
        Model._registered[constructor.name] = constructor
    }

    static async table_exists(): Promise<boolean> {
        const table_name = this._table
        const class_name = this.name

        const table_exists_query = `select exists (select table_name from information_schema.tables where table_name = '${table_name}');`
        console.log('[table_exists_query]', table_exists_query)

        try {
            const result = await this._conn.query(table_exists_query)
            const exists = result.rows[0].exists
            console.log('[exists]', exists)
            // return false
            return exists
        } catch(err) {
            console.error(`[err] Error checking table exists for ${class_name}:`, err)
            return false
        }
    }

    static create_table_sql(drop: boolean) {
        const table_name = this._table
        const class_name = this.name

        const field_defs = this._fields
        field_defs['created_at'] = {type: 'timestamp', default: 'now()'}
        field_defs['updated_at'] = {type: 'timestamp'}
        const field_defs_sql = make_field_defs_sql(field_defs)

        let create_table_query = ''
        if (drop) create_table_query += `drop table if exists ${table_name} cascade;\n`
        create_table_query += `create table ${table_name} (\n    id serial primary key`
        if (field_defs_sql.length > 0) {
            create_table_query += ',\n    ' + field_defs_sql
        }
        create_table_query += '\n);'
        return create_table_query
    }

    static async create_table(drop: boolean) {
        const table_name = this._table
        const class_name = this.name
        const create_table_query = this.create_table_sql(drop)

        try {
            // console.log(`\n* Creating table ${table_name} for ${class_name}`)
            await this._conn.query(create_table_query)
            // console.log(`** Created table ${table_name} for type ${class_name}`)
        } catch(err) {
            console.error(`[err] Error creating table ${table_name} for ${class_name}:`, err)
        }
    }

    static async ensure_relationships() {
        Object.entries(this._relationships).map(([relationship_name, relationship_class]) => {
            if (relationship_class instanceof ReverseRelationship) {
                relationship_class.update_forward()
            }
        })
    }

    static async create_relationship_tables() {
        const create_promises = Object.entries(this._relationships).map(async ([relationship_name, relationship_class]) => {
            if (relationship_class instanceof Relationship) {
                await relationship_class.create_table(this._conn)
            }
        })
        await Promise.all(create_promises)
    }

    static create_relationship_tables_sql(drop: boolean) {
        const relationship_tables_sqls = Object.entries(this._relationships)
            .filter(([relationship_name, relationship_class]) =>
                relationship_class instanceof Relationship
            )
            .map(([relationship_name, relationship_class]) =>
                (relationship_class as Relationship).create_table_sql(drop)
            )
        return relationship_tables_sqls.join('\n\n')
    }

    // Static CRUD methoods
    // -------------------------------------------------------------------------

    static async create<T extends Model>(create_obj: AnyDict): Promise<T> {
        const defined_create_obj = defined(create_obj)
        const field_names = Object.keys(defined_create_obj)
        const field_values = Object.values(defined_create_obj)
        const placeholders = field_names.map((_, i) => '$' + (i + 1))
        const insert_query = `insert into ${this._table} (${field_names.join(', ')}) values (${placeholders.join(', ')}) returning *`
        const result = await this._conn.query(insert_query, field_values)
        const instance = new this(result.rows[0])
        return <T>instance
    }

    static async get<T extends Model>(id: number): Promise<T | null> {
        const result = await this._conn.query(`select * from ${this._table} where id = $1`, [id])
        if (result.rows.length == 0) {
            return null
        } else {
            const instance = new this(result.rows[0])
            return <T>instance
        }
    }

    static async find<T extends Model>(query: Query, options: QueryOptions = {}): Promise<T[]> {
        let where_clause = ""
        if (Object.keys(query).length) {
            where_clause += "where "
            for (let [key, value] of Object.entries(query)) {
                const where_value = `'${value}'`
                where_clause += `${key} = ${where_value}`
            }
        }
        let select_query = `select * from ${this._table} ${where_clause}`
        if (options.limit) {
            select_query += ` limit ${options.limit}`
        }
        console.log('[select_query]', select_query)
        const result = await this._conn.query(select_query)
        return <T[]>result.rows.map(row => new this(row))
    }

    static async find_one<T extends Model>(query: Query): Promise<T> {
        const all_results = await this.find(query, {limit: 1})
        return <T>all_results[0]
    }

    static async update<T extends Model>(id: number, update_obj: AnyDict): Promise<T> {
        const defined_update_obj = defined(update_obj)
        const field_names = Object.keys(defined_update_obj)
        const field_values = Object.values(defined_update_obj)
        const set_fields = field_names.map((key, i) => `${key}=$${i + 1}`)
        set_fields.push('updated_at=now()') // Set last updated
        const update_query = `update ${this._table} set ${set_fields.join(', ')} where id=${id} returning *`
        const result = await this._conn.query(update_query, field_values)
        const instance = new this(result.rows[0])
        return <T>instance
    }

    async update<T extends Model>(update_obj: AnyDict): Promise<T> {
        const this_class = (this.constructor as typeof Model)
        return this_class.update(this.id, update_obj)
    }

    static async delete<T extends Model>(id: number): Promise<{success: boolean}> {
        const table_name = this._table
        const delete_query = `delete from ${table_name} where id=$1`
        await this._conn.query(delete_query, [id])
        return {success: true}
    }

    async delete<T extends Model>(): Promise<{success: boolean}> {
        const this_class = (this.constructor as typeof Model)
        return this_class.delete(this.id)
    }

    // Relationship CRUD methods
    // -------------------------------------------------------------------------

    async set_related<T extends Model>(relationship_name: string, item: T) {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()
        if (!singular) {
            throw new Error(`Can't use set() for ${this_class.name}'s non-singular ${relationship_class.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        const field_names = [from_column, to_column]
        const placeholders = ['$1', '$2']
        let this_column, related_column, related_id, field_values

        if (relationship_class.kind == 'forward') {
            field_values = [this.id, item.id]
            this_column = from_column
            related_column = to_column
            related_id = item.id
        } else {
            field_values = [item.id, this.id]
            this_column = to_column
            related_column = from_column
            related_id = item.id
        }

        // Conflict resolution for constrained relationships
        // ---------------------------------------------------------------------
        // For a forward to-one relationship, a conflict on the `from` key means this relationship has already been set. Instead of inserting a new row, the existing row should be updated to change the `to` key.
        // A reverse to-one relationship is a forward one-to relationship. A conflict on the `to` key means the relationship has already been set and the `from` needs to be changed.

        let on_conflict
        if (singular) {
            on_conflict = `on conflict (${this_column}) do update set ${related_column} = ${related_id}`
        }

        const insert_query = `insert into ${relationship_table} (${field_names.join(', ')}) values (${placeholders.join(', ')}) ${on_conflict || ''}`
        // console.log('[insert_query]', insert_query)
        const result = await this_class._conn.query(insert_query, field_values)
    }

    async add_related<T extends Model>(relationship_name: string, items: T[]) {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()
        if (singular) {
            throw new Error(`Can't use add() for ${this_class.name}'s singular ${relationship_class.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        const field_names = [from_column, to_column]
        let placeholder_sets = items.map((item, i) => `($${i*2+1}, $${i*2+2})`)
        let field_values

        if (relationship_class.kind == 'forward') {
            const from_id = this.id
            field_values = flatten(items.map((item) => [from_id, item.id]))
        } else {
            const to_id = this.id
            field_values = flatten(items.map((item) => [item.id, to_id]))
        }

        const insert_query = `insert into ${relationship_table} (${field_names.join(', ')}) values ${placeholder_sets.join(', ')} returning *`
        const result = await this_class._conn.query(insert_query, field_values)
        return result.rows
    }

    async get_relationship<T extends Model>(relationship_name: string): Promise<T | null> {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()
        if (!singular) {
            throw new Error(`Can't use get() for ${this_class.name}'s non-singular ${relationship_class.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column: string

        if (relationship_class.kind == 'forward') {
            this_column = from_column
        } else {
            this_column = to_column
        }

        const select_query = `select * from ${relationship_table} where ${this_column} = $1`
        const result = await this_class._conn.query(select_query, [this.id])

        return result.rows[0]
    }

    async get_related<T extends Model>(relationship_name: string): Promise<T | null> {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()

        let related_class: ModelRef
        let related_column: string

        if (relationship_class.kind == 'forward') {
            related_class = to_class
            related_column = to_column
        } else {
            related_class = from_class
            related_column = from_column
        }

        const result = await this.get_relationship(relationship_name)
        if (result != null) {
            return await related_class.get(result[related_column])
        } else {
            return null
        }
    }

    async find_related<T extends Model>(relationship_name: string, options: AnyDict = {}): Promise<T[]> {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()
        if (singular) {
            throw new Error(`Can't use find() for ${this_class.name}'s singular ${relationship_class.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column: string
        let related_class: ModelRef
        let related_column: string

        if (relationship_class.kind == 'forward') {
            this_column = from_column
            related_class = to_class
            related_column = to_column
        }
        else {
            this_column = to_column
            related_class = from_class
            related_column = from_column
        }

        const related_table = related_class._table
        let select_query = `select ${related_table}.* from ${relationship_table} inner join ${related_table} on ${relationship_table}.${related_column} = ${related_table}.id  where ${this_column} = $1`
        if (options.order) {
            select_query += ` order by ${options.order}`
        }
        if (options.limit) {
            select_query += ` limit ${options.limit}`
        }
        const result = await this_class._conn.query(select_query, [this.id])

        return <T[]>result.rows.map((row) => new related_class(row))
    }

    async unset_related<T extends Model>(relationship_name: string, item: T) {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()
        if (!singular) {
            throw new Error(`Can't use unset() for ${this_class.name}'s non-singular ${relationship_class.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column, related_column
        if (relationship_class.kind == 'forward') {
            this_column = from_column
            related_column = to_column
        } else {
            this_column = to_column
            related_column = from_column
        }

        const delete_query = `delete from ${relationship_table} where ${this_column} = $1 and ${related_column} = $2`
        await this_class._conn.query(delete_query, [this.id, item.id])
    }

    async remove_related<T extends Model>(relationship_name: string, items: T[]) {
        const this_class = (this.constructor as typeof Model)
        const relationship_class = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship_class.get_details()

        if (!Array.isArray(items)) {
            throw new Error(`Must call remove() with array of items to remove`)
        }

        if (singular) {
            throw new Error(`Can't use remove() for ${this_class.name}'s singular ${relationship_class.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column, related_column
        if (relationship_class.kind == 'forward') {
            this_column = from_column
            related_column = to_column
        } else {
            this_column = to_column
            related_column = from_column
        }

        const item_ids = items.map((item) => item.id)
        const placeholders = items.map((_, i) => '$' + (i + 2)) // $1 is this_column's ID value

        const delete_query = `delete from ${relationship_table} where ${this_column} = $1 and ${related_column} in (${placeholders.join(', ')})`
        await this_class._conn.query(delete_query, [this.id].concat(item_ids))
    }

    // GraphQL methods
    // -------------------------------------------------------------------------
    // TODO

}


