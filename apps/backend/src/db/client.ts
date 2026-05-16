import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { DB_PATH } from '@unginx/shared'

const dbPath = process.env['DB_PATH'] ?? DB_PATH

fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')
db.pragma('busy_timeout = 5000')
db.pragma('foreign_keys = ON')

export default db
