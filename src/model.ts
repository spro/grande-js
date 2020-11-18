import * as pg from 'pg'

import {flatten} from './helpers'
import {type_pg_map, FieldDefs, make_field_defs_str} from './fields'
import {Relationship, ReverseRelationship, AnyRelationship} from './relationship'

// Supporting types & classes

type Query = {
    [key: string]: any
}

// Main model class
// -----------------------------------------------------------------------------

export class Model {
    // For Model super-class
    static _conn: any
    static _registered = {}

    // Per Model sub-class
    static _table: string
    static _fields: FieldDefs
    static _relationships: {[key: string]: AnyRelationship}

    id: number

    constructor(data) {
        Object.assign(this, data)
    }

    static register(constructor: Function) {
        Model._registered[constructor.name] = constructor
    }

    static async create_table() {
        const table_name = this._table
        const class_name = this.name
        // console.log(`\n* Create table ${table_name} for ${class_name}`)

        const field_defs = this._fields
        field_defs['created_at'] = {type: 'timestamp', default: 'now()'}
        field_defs['updated_at'] = {type: 'timestamp'}
        const field_defs_str = make_field_defs_str(field_defs)

        let create_table_query = `
drop table if exists ${table_name} cascade;
create table ${table_name} (
    id serial primary key`
        if (field_defs_str.length > 0) {
            create_table_query += ',\n    ' + field_defs_str
        }
        create_table_query += ')'

        try {
            await this._conn.query(create_table_query)
        } catch(err) {
            console.error(`[err] Error creating table for ${class_name}:`, err)
        } finally {
            // console.log(`** Created table ${table_name} for type ${class_name}`)
        }
    }

    static async create_tables() {
        await this.create_table()
    }

    static async ensure_relationships() {
        Object.entries(this._relationships).map(([relationship_name, relationship]) => {
            if (relationship instanceof ReverseRelationship) {
                relationship.update_forward()
            }
        })
    }

    static async create_relationship_tables() {
        const create_promises = Object.entries(this._relationships).map(async ([relationship_name, relationship]) => {
            if (relationship instanceof Relationship) {
                await relationship.create_table(this._conn)
            }
        })
        await Promise.all(create_promises)
    }

    // Static CRUD methoods
    // -------------------------------------------------------------------------

    static async create<T extends Model>(create_obj): Promise<T> {
        const field_names = Object.keys(create_obj)
        const placeholders = field_names.map((_, i) => '$' + (i + 1))
        const field_values = field_names.map(field_name => create_obj[field_name])
        const insert_query = `insert into ${this._table} (${field_names.join(', ')}) values (${placeholders.join(', ')}) returning *`
        const result = await this._conn.query(insert_query, field_values)
        const instance = new this(result.rows[0])
        return <T>instance
    }

    static async get<T extends Model>(id: number): Promise<T> {
        const result = await this._conn.query(`select * from ${this._table} where id = $1`, [id])
        if (result.rows.length == 0) {
            return null
        } else {
            const instance = new this(result.rows[0])
            return <T>instance
        }
    }

    static async find<T extends Model>(query: Query): Promise<T[]> {
        let where_clause = ""
        for (let [key, value] of Object.entries(query)) {
            where_clause += `${key} = ${value}`
        }
        const select_query = `select * from ${this._table} where ${where_clause}`
        const result = await this._conn.query(select_query)
        return <T[]>result.rows
    }

    // TODO: Non-static update and delete

    static async update<T extends Model>(id: number, update_obj): Promise<T> {
        const field_names = Object.keys(update_obj)
        const field_values = field_names.map(field_name => update_obj[field_name])
        const set_fields = field_names.map((key, i) => `${key}=$${i + 1}`)
        set_fields.push('updated_at=now()') // Set last updated
        const update_query = `update ${this._table} set ${set_fields.join(', ')} where id=${id} returning *`
        const result = await this._conn.query(update_query, field_values)
        const instance = new this(result.rows[0])
        return <T>instance
    }

    static async delete<T extends Model>(id: number): Promise<{success: boolean}> {
        const table_name = this._table
        const delete_query = `delete from ${table_name} where id=$1`
        await this._conn.query(delete_query, [id])
        return {success: true}
    }

    // Relationship CRUD methods
    // -------------------------------------------------------------------------

    async set_related<T extends Model>(relationship_name: string, item: T) {
        const this_class = (this.constructor as typeof Model)
        const relationship = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship.get_details()
        if (!singular) {
            throw new Error(`Can't use set() for ${this_class.name}'s non-singular ${relationship.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        const field_names = [from_column, to_column]
        const placeholders = ['$1', '$2']
        let this_column, related_column, related_id, field_values

        if (relationship.kind == 'forward') {
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
        const relationship = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship.get_details()
        if (singular) {
            throw new Error(`Can't use add() for ${this_class.name}'s singular ${relationship.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        const field_names = [from_column, to_column]
        let placeholder_sets = items.map((item, i) => `($${i*2+1}, $${i*2+2})`)
        let field_values

        if (relationship.kind == 'forward') {
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

    async get_related<T extends Model>(relationship_name: string): Promise<T> {
        const this_class = (this.constructor as typeof Model)
        const relationship = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship.get_details()
        if (!singular) {
            throw new Error(`Can't use get() for ${this_class.name}'s non-singular ${relationship.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column, related_class, related_column
        if (relationship.kind == 'forward') {
            this_column = from_column
            related_class = to_class
            related_column = to_column
        }
        else {
            this_column = to_column
            related_class = from_class
            related_column = from_column
        }

        const select_query = `select * from ${relationship_table} where ${this_column} = $1`
        const result = await this_class._conn.query(select_query, [this.id])

        if (result.rows.length == 0) return null
        return await related_class.get(result.rows[0][related_column])
    }

    async find_related<T extends Model>(relationship_name: string): Promise<T[]> {
        const this_class = (this.constructor as typeof Model)
        const relationship = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship.get_details()
        if (singular) {
            throw new Error(`Can't use find() for ${this_class.name}'s singular ${relationship.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column, related_class, related_column
        if (relationship.kind == 'forward') {
            this_column = from_column
            related_class = to_class
            related_column = to_column
        }
        else {
            this_column = to_column
            related_class = from_class
            related_column = from_column
        }

        const select_query = `select * from ${relationship_table} where ${this_column} = $1`
        const result = await this_class._conn.query(select_query, [this.id])

        return await Promise.all(result.rows.map((row) => related_class.get(row[related_column])))
    }

    async unset_related<T extends Model>(relationship_name: string, item: T) {
        const this_class = (this.constructor as typeof Model)
        const relationship = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship.get_details()
        if (!singular) {
            throw new Error(`Can't use unset() for ${this_class.name}'s non-singular ${relationship.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column, related_column
        if (relationship.kind == 'forward') {
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
        const relationship = this_class._relationships[relationship_name]
        const [from_class, to_class, from_column, to_column, relationship_table, singular] = relationship.get_details()

        if (!Array.isArray(items)) {
            throw new Error(`Must call remove() with array of items to remove`)
        }

        if (singular) {
            throw new Error(`Can't use remove() for ${this_class.name}'s singular ${relationship.kind == 'reverse' && 'reverse '  || ''}relationship ${relationship_name}`)
        }

        let this_column, related_column
        if (relationship.kind == 'forward') {
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


