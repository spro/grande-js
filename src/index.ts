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

// Set up connections between all related models

export async function ensure_relationships() {
    for (let model_key in Model._registered) {
        const model = Model._registered[model_key]
        model.ensure_relationships()
    }
}

// Connect & release
// -------------------------------------------------------------------------

export let pool: pg.Pool

export async function connect(connection_options: AnyDict = {}) {
    pool = new pg.Pool(connection_options)
    Model._pool = pool

    await ensure_relationships()

    return pool
}

export async function generate_sql(drop: boolean = false): Promise<string> {
    await ensure_relationships()
    
    let all_sql = "-- Models\n\n"

    // Create model tables
    for (let model_key in Model._registered) {
        const model = Model._registered[model_key]
        const model_sql = model.create_table_sql(drop)
        all_sql += model_sql + '\n'
    }
    
    all_sql += '\n-- Relationships\n\n'

    // Create relationship tables
    for (let model_key in Model._registered) {
        const model = Model._registered[model_key]
        const relationships_sql = model.create_relationship_tables_sql(drop)
        if (relationships_sql.length) all_sql += relationships_sql + '\n'
    }

    return all_sql
}

export async function end() {
    await pool.end()
}
