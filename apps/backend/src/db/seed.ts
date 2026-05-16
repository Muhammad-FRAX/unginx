import { randomBytes } from 'crypto'
import * as argon2 from 'argon2'
import db from './client.js'
import { DEFAULT_ADMIN_PATH, DEFAULT_USERNAME, DEFAULT_PASSWORD } from '@unginx/shared'

export async function seedDatabase(): Promise<void> {
  const insertSetting = db.prepare('INSERT OR IGNORE INTO setting (key, value) VALUES (?, ?)')

  const hasSchema = db
    .prepare('SELECT value FROM setting WHERE key = ?')
    .get('schema_version') as { value: string } | undefined

  if (!hasSchema) {
    const jwtSecret = randomBytes(64).toString('hex')
    db.transaction(() => {
      insertSetting.run('admin_path', DEFAULT_ADMIN_PATH)
      insertSetting.run('jwt_secret', jwtSecret)
      insertSetting.run('theme_default', 'system')
      insertSetting.run('schema_version', '1')
    })()
    console.log('[db] Seeded default settings')
  } else {
    // Ensure jwt_secret exists if somehow missing
    const hasSecret = db
      .prepare('SELECT value FROM setting WHERE key = ?')
      .get('jwt_secret') as { value: string } | undefined
    if (!hasSecret) {
      insertSetting.run('jwt_secret', randomBytes(64).toString('hex'))
    }
  }

  const { count } = db
    .prepare('SELECT COUNT(*) as count FROM user')
    .get() as { count: number }

  if (count === 0) {
    const username = process.env['UNGINX_USERNAME'] ?? DEFAULT_USERNAME
    const password = process.env['UNGINX_PASSWORD'] ?? DEFAULT_PASSWORD
    const mustChangePassword =
      !process.env['UNGINX_USERNAME'] && !process.env['UNGINX_PASSWORD'] ? 1 : 0

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id })
    const now = Date.now()

    db.prepare(
      'INSERT INTO user (username, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(username, passwordHash, mustChangePassword, now, now)

    console.log(`[db] Seeded admin user: ${username}`)
  }
}
