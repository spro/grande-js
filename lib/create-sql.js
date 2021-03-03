"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const model_1 = require("./model");
for (let model_key in model_1.Model._registered) {
    const model = model_1.Model._registered[model_key];
    await model.create_table_query(false);
    await model.create_relationship_tables();
}
//# sourceMappingURL=create-sql.js.map