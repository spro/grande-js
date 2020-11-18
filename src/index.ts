import * as pg from 'pg'

// x1: Create a table from field definitions
// x2: Refine field definitions
// 3: Create relationship tables
// 4: TypeScript class from field definition
// 5: Rest of query types
// 6: Graphql queries

import {Model} from './model'
import {FieldDef} from './fields'
import {Relationship, ToManyRelationship, ToOneRelationship, ReverseRelationship} from './relationship'

export {
    Model, FieldDef,
    Relationship, ToManyRelationship, ToOneRelationship, ReverseRelationship
}

// Setup & teardown
// -------------------------------------------------------------------------

let conn, pool

export async function setup() {
    pool = new pg.Pool({
        database: 'cirrcle'
    })
    conn = await pool.connect()

    Model._conn = conn
    Relationship._conn = conn

    for (let model_key in Model._registered) {
        const model = Model._registered[model_key]
        await model.create_tables()
        await model.ensure_relationships()
        await model.create_relationship_tables()
    }

    return conn
}

export async function teardown() {
    await conn.release()
}
