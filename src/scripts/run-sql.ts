import * as pg from 'pg'
import * as fs from 'fs'

let pool: pg.Pool
let conn: pg.PoolClient

const connection_options = {
    database: 'cirrcle'
}

const sql = fs.readFileSync('test.sql').toString()

async function main() {
    pool = new pg.Pool(connection_options)
    conn = await pool.connect()

    console.log('\n')

    try {
        const result = await conn.query(sql)
        console.log(result.rows)
    } catch (err) {
        console.error('Error:', err.message)
    }

    await conn.release()
}

main()
