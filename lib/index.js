"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.release = exports.create_sql = exports.connect = exports.conn = exports.ReverseRelationship = exports.ToOneRelationship = exports.ToManyRelationship = exports.Relationship = exports.FieldDef = exports.Model = void 0;
const pg = require("pg");
const model_1 = require("./model");
Object.defineProperty(exports, "Model", { enumerable: true, get: function () { return model_1.Model; } });
const fields_1 = require("./fields");
Object.defineProperty(exports, "FieldDef", { enumerable: true, get: function () { return fields_1.FieldDef; } });
const relationship_1 = require("./relationship");
Object.defineProperty(exports, "Relationship", { enumerable: true, get: function () { return relationship_1.Relationship; } });
Object.defineProperty(exports, "ToManyRelationship", { enumerable: true, get: function () { return relationship_1.ToManyRelationship; } });
Object.defineProperty(exports, "ToOneRelationship", { enumerable: true, get: function () { return relationship_1.ToOneRelationship; } });
Object.defineProperty(exports, "ReverseRelationship", { enumerable: true, get: function () { return relationship_1.ReverseRelationship; } });
// Connect & release
// -------------------------------------------------------------------------
let pool;
let conn;
exports.conn = conn;
async function connect(connection_options = {}) {
    pool = new pg.Pool(connection_options);
    exports.conn = conn = await pool.connect();
    model_1.Model._conn = conn;
    // Let reverse & forward relationships know about each other
    for (let model_key in model_1.Model._registered) {
        const model = model_1.Model._registered[model_key];
        await model.ensure_relationships();
    }
    return conn;
}
exports.connect = connect;
function create_sql(drop = false) {
    for (let model_key in model_1.Model._registered) {
        const model = model_1.Model._registered[model_key];
        const model_sql = model.create_table_sql(drop);
        const relationships_sql = model.create_relationship_tables_sql(drop);
        console.log(model_sql);
        if (relationships_sql.length)
            console.log('\n' + relationships_sql);
        else
            console.log('');
    }
}
exports.create_sql = create_sql;
async function release() {
    await conn.release();
}
exports.release = release;
//# sourceMappingURL=index.js.map