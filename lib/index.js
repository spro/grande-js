"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.end = exports.generate_sql = exports.connect = exports.pool = exports.ensure_relationships = exports.ReverseRelationship = exports.ToOneRelationship = exports.ToManyRelationship = exports.Relationship = exports.FieldDef = exports.Model = void 0;
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
// Set up connections between all related models
async function ensure_relationships() {
    for (let model_key in model_1.Model._registered) {
        const model = model_1.Model._registered[model_key];
        model.ensure_relationships();
    }
}
exports.ensure_relationships = ensure_relationships;
async function connect(connection_options = {}) {
    exports.pool = new pg.Pool(connection_options);
    model_1.Model._pool = exports.pool;
    await ensure_relationships();
    return exports.pool;
}
exports.connect = connect;
async function generate_sql(drop = false) {
    await ensure_relationships();
    let all_sql = "-- Models\n\n";
    // Create model tables
    for (let model_key in model_1.Model._registered) {
        const model = model_1.Model._registered[model_key];
        const model_sql = model.create_table_sql(drop);
        all_sql += model_sql + '\n';
    }
    all_sql += '\n-- Relationships\n\n';
    // Create relationship tables
    for (let model_key in model_1.Model._registered) {
        const model = model_1.Model._registered[model_key];
        const relationships_sql = model.create_relationship_tables_sql(drop);
        if (relationships_sql.length)
            all_sql += relationships_sql + '\n';
    }
    return all_sql;
}
exports.generate_sql = generate_sql;
async function end() {
    await exports.pool.end();
}
exports.end = end;
//# sourceMappingURL=index.js.map