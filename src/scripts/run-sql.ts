import * as pg from 'pg'
import * as fs from 'fs'

let pool: pg.Pool
let conn: pg.PoolClient

const filename = process.argv[2]
const sql = fs.readFileSync(filename).toString()

async function main() {
    pool = new pg.Pool({})
    conn = await pool.connect()

    console.log('\n')

    try {
        const result = await conn.query(sql)
        if (result.rows) {
            console.log(result.rows)
        } else if (Array.isArray(result)) {
            console.log(Object.keys(result[0]))
            result.map(r => console.log(r.rows))
        }
    } catch (err) {
        console.error('Error:', err)
    }

    await conn.release()
    process.exit()
}

main()
