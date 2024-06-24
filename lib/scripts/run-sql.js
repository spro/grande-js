"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg = require("pg");
const fs = require("fs");
let pool;
let conn;
const filename = process.argv[2];
const sql = fs.readFileSync(filename).toString();
async function main() {
    pool = new pg.Pool({});
    conn = await pool.connect();
    console.log('\n');
    try {
        const result = await conn.query(sql);
        if (result.rows) {
            console.log(result.rows);
        }
        else if (Array.isArray(result)) {
            console.log(Object.keys(result[0]));
            result.map(r => console.log(r.rows));
        }
    }
    catch (err) {
        console.error('Error:', err);
    }
    await conn.release();
    process.exit();
}
main();
//# sourceMappingURL=run-sql.js.map