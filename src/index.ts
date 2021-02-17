import * as pg from 'pg'

// x1: Create a table from field definitions
// x2: Refine field definitions
// 3: Create relationship tables
// 4: TypeScript class from field definition
// 5: Rest of query types
// 6: Graphql queries

import {AnyDict} from './helpers'
import {Model} from './model'
import {FieldDef} from './fields'
import {Relationship, ToManyRelationship, ToOneRelationship, ReverseRelationship} from './relationship'

export {
    Model, FieldDef,
    Relationship, ToManyRelationship, ToOneRelationship, ReverseRelationship
}

// Connect & release
// -------------------------------------------------------------------------

let pool: pg.Pool
let conn: pg.PoolClient

export {conn}

export async function connect(connection_options: AnyDict = {}) {
    pool = new pg.Pool(connection_options)
    conn = await pool.connect()

    Model._conn = conn

    // Let reverse & forward relationships know about each other
    for (let model_key in Model._registered) {
        const model = Model._registered[model_key]
        await model.ensure_relationships()
    }

    return conn
}

export function create_sql(drop: boolean = false) {
    for (let model_key in Model._registered) {
        const model = Model._registered[model_key]
        const model_sql = model.create_table_sql(drop)
        const relationships_sql = model.create_relationship_tables_sql(drop)
        console.log(model_sql)
        if (relationships_sql.length) console.log('\n' + relationships_sql)
        else console.log('')
    }
}

export async function release() {
    await conn.release()
}
