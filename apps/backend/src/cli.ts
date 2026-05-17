#!/usr/bin/env node
/**
 * unginx CLI — recovery and management commands
 *
 * Usage (inside the container):
 *   unginx reset-password [--user <username>] [--password <password>]
 *   unginx reset-admin-path
 *   unginx whoami
 *   unginx export
 *   unginx import [--replace]
 */

import { runMigrations } from './db/migrate.js'
import db from './db/client.js'
import { hashPassword } from './auth/password.js'
import { runSavePipeline, SaveError } from './pipeline/save.js'
import { reloadNginx } from './nginx/reload.js'
import { runNginxTestOnActive } from './nginx/test.js'
import {
  STAGING_LOCK,
  DEFAULT_ADMIN_PATH,
} from '@unginx/shared'
import readline from 'readline'
import fs from 'fs'
import { spawnSync } from 'child_process'
import { randomUUID } from 'crypto'

const NGINX_CONF_TEMPLATE = '/etc/nginx/conf.d/00-unginx.conf.template'
const NGINX_CONF_DEST = '/etc/nginx/conf.d/00-unginx.conf'

// ─── File-based advisory lock ────────────────────────────────────────────────
// Uses O_EXCL creation for atomic cross-process mutual exclusion.

async function acquireLock(timeoutMs = 10_000): Promise<() => void> {
  const start = Date.now()
  while (true) {
    try {
      const fd = fs.openSync(
        STAGING_LOCK,
        fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL
      )
      fs.writeSync(fd, String(process.pid))
      fs.closeSync(fd)
      return () => {
        try {
          fs.unlinkSync(STAGING_LOCK)
        } catch {
          // best-effort cleanup
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
      if (Date.now() - start > timeoutMs) {
        throw new Error(
          'Could not acquire staging lock after 10 seconds.\n' +
            'Another save operation may be in progress. Try again shortly.\n' +
            `Lock file: ${STAGING_LOCK}`
        )
      }
      await sleep(200)
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Readline helpers ─────────────────────────────────────────────────────────

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

// Prompts for a password, masking input with '*' on a TTY.
async function promptPassword(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }

  return new Promise((resolve) => {
    process.stdout.write(question)
    const { stdin, stdout } = process
    stdin.setRawMode(true)
    stdin.setEncoding('utf8')
    stdin.resume()
    let pw = ''

    const onData = (char: string) => {
      if (char === '\r' || char === '\n') {
        stdin.setRawMode(false)
        stdin.removeListener('data', onData)
        stdin.pause()
        stdout.write('\n')
        resolve(pw)
      } else if (char === '\x03') {
        // Ctrl+C
        stdin.setRawMode(false)
        process.exit(1)
      } else if (char === '\x7f' || char === '\b') {
        // Backspace
        if (pw.length > 0) {
          pw = pw.slice(0, -1)
          stdout.write('\b \b')
        }
      } else {
        pw += char
        stdout.write('*')
      }
    }

    stdin.on('data', onData)
  })
}

// Reads all of stdin (for `import` command).
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

// ─── Simple arg parser ────────────────────────────────────────────────────────

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === undefined || !arg.startsWith('--')) continue
    const key = arg.slice(2)
    const next = args[i + 1]
    if (next !== undefined && !next.startsWith('--')) {
      result[key] = next
      i++
    } else {
      result[key] = true
    }
  }
  return result
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM setting WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value ?? null
}

function getAdminPath(): string {
  return getSetting('admin_path') ?? DEFAULT_ADMIN_PATH
}

function getAdminUser(): { id: number; username: string } | undefined {
  return db
    .prepare('SELECT id, username FROM user LIMIT 1')
    .get() as { id: number; username: string } | undefined
}

// ─── Nginx config helpers ─────────────────────────────────────────────────────

function renderNginxConf(adminPath: string): void {
  if (!fs.existsSync(NGINX_CONF_TEMPLATE)) {
    // Template not present (e.g. running outside container) — skip silently
    return
  }
  const appPort = process.env['APP_PORT'] ?? '80'
  const template = fs.readFileSync(NGINX_CONF_TEMPLATE, 'utf8')
  const rendered = template
    .replace(/\$\{APP_PORT\}/g, appPort)
    .replace(/\$\{ADMIN_PATH\}/g, adminPath)
  fs.writeFileSync(NGINX_CONF_DEST, rendered, 'utf8')
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function cmdResetPassword(args: string[]): Promise<void> {
  const opts = parseArgs(args)
  let username = typeof opts['user'] === 'string' ? opts['user'] : undefined
  let password = typeof opts['password'] === 'string' ? opts['password'] : undefined

  if (!username || !password) {
    const user = getAdminUser()
    if (!user) {
      console.error('No admin user found in the database.')
      process.exit(1)
    }

    console.log('--- unginx password reset ---')

    if (!username) {
      const input = await prompt(`Username [${user.username}]: `)
      username = input || user.username
    }

    if (!password) {
      password = await promptPassword('New password: ')
      if (!password) {
        console.error('Password cannot be empty.')
        process.exit(1)
      }
      const confirm = await promptPassword('Confirm password: ')
      if (password !== confirm) {
        console.error('Passwords do not match.')
        process.exit(1)
      }
    }
  }

  if (!password || password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const release = await acquireLock()
  try {
    const user = db
      .prepare('SELECT id FROM user WHERE username = ?')
      .get(username) as { id: number } | undefined

    if (!user) {
      console.error(`User "${username}" not found.`)
      process.exit(1)
    }

    const hash = await hashPassword(password)
    db.prepare(
      'UPDATE user SET password_hash = ?, must_change_password = 0, updated_at = ? WHERE id = ?'
    ).run(hash, Date.now(), user.id)

    console.log(`Password updated for user "${username}".`)
  } finally {
    release()
  }
}

async function cmdResetAdminPath(): Promise<void> {
  const current = getAdminPath()

  if (current === DEFAULT_ADMIN_PATH) {
    console.log(`Admin path is already "${DEFAULT_ADMIN_PATH}" — nothing to do.`)
    return
  }

  console.log(`Resetting admin path from "${current}" to "${DEFAULT_ADMIN_PATH}"…`)

  const release = await acquireLock()
  try {
    // Update the DB setting
    db.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(
      'admin_path',
      DEFAULT_ADMIN_PATH
    )

    // Re-render 00-unginx.conf from the template with the default admin path
    renderNginxConf(DEFAULT_ADMIN_PATH)

    // Verify the new nginx config is valid
    const testResult = await runNginxTestOnActive()
    if (!testResult.ok) {
      // Undo the DB change
      db.prepare('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)').run(
        'admin_path',
        current
      )
      renderNginxConf(current)
      console.error('nginx rejected the new config — admin path reset aborted.')
      console.error(testResult.rawOutput)
      process.exit(1)
    }

    // Reload nginx to apply the new admin location
    const reloadResult = await reloadNginx()
    if (!reloadResult.ok) {
      console.warn(
        `nginx reload failed: ${reloadResult.error}\n` +
          'The DB has been updated but nginx could not be reloaded.\n' +
          'Restart the container to apply the change.'
      )
    } else {
      console.log(`Admin path reset to "${DEFAULT_ADMIN_PATH}". nginx reloaded.`)
    }
  } finally {
    release()
  }
}

function cmdWhoami(): void {
  const adminPath = getAdminPath()
  const user = getAdminUser()
  const ngVersion = getSetting('nginx_version') ?? getNginxVersion()
  const schemaVersion = getSetting('schema_version') ?? 'unknown'

  console.log(`Admin path   : ${adminPath}`)
  console.log(`Admin user   : ${user?.username ?? '(none)'}`)
  console.log(`Schema       : v${schemaVersion}`)
  console.log(`nginx        : ${ngVersion}`)
}

function cmdExport(): void {
  const groups = db.prepare('SELECT * FROM group_ ORDER BY kind, name').all()
  const routes = db.prepare('SELECT * FROM route ORDER BY path').all()
  const fileRoutes = db.prepare('SELECT * FROM file_route ORDER BY path').all()

  const payload = {
    exportedAt: new Date().toISOString(),
    groups,
    routes,
    fileRoutes,
  }

  process.stdout.write(JSON.stringify(payload, null, 2))
  process.stdout.write('\n')
}

async function cmdImport(args: string[]): Promise<void> {
  const opts = parseArgs(args)
  const mode: 'merge' | 'replace' = opts['replace'] === true ? 'replace' : 'merge'

  let rawJson: string
  try {
    rawJson = await readStdin()
  } catch {
    console.error('Failed to read from stdin.')
    process.exit(1)
    return
  }

  if (!rawJson.trim()) {
    console.error('No input received on stdin. Pipe a JSON export file to this command.')
    console.error('Example: docker exec -i unginx unginx import --replace < backup.json')
    process.exit(1)
    return
  }

  interface ImportRow {
    id?: string
    [key: string]: unknown
  }

  interface ImportPayload {
    groups?: ImportRow[]
    routes?: ImportRow[]
    fileRoutes?: ImportRow[]
  }

  let payload: ImportPayload
  try {
    payload = JSON.parse(rawJson) as ImportPayload
  } catch {
    console.error('Invalid JSON — could not parse the input.')
    process.exit(1)
    return
  }

  const groups = Array.isArray(payload.groups) ? payload.groups : []
  const routes = Array.isArray(payload.routes) ? payload.routes : []
  const fileRoutes = Array.isArray(payload.fileRoutes) ? payload.fileRoutes : []

  console.log(
    `Importing ${groups.length} group(s), ${routes.length} route(s), ${fileRoutes.length} file route(s) [mode: ${mode}]…`
  )

  const release = await acquireLock()
  try {
    const result = await runSavePipeline(
      () => {
        if (mode === 'replace') {
          db.prepare('DELETE FROM route').run()
          db.prepare('DELETE FROM file_route').run()
          db.prepare('DELETE FROM group_').run()
        }

        const orMode = mode === 'replace' ? 'REPLACE' : 'IGNORE'

        for (const g of groups) {
          db.prepare(
            `INSERT OR ${orMode} INTO group_ (id, kind, name, description, created_at)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            g['id'] ?? randomUUID(),
            g['kind'],
            g['name'],
            g['description'] ?? null,
            g['created_at'] ?? Date.now()
          )
        }

        for (const r of routes) {
          db.prepare(
            `INSERT OR ${orMode} INTO route
             (id, group_id, name, path, upstream_host, upstream_port, upstream_scheme,
              strip_prefix, websocket, enabled, description, advanced_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            r['id'] ?? randomUUID(),
            r['group_id'] ?? null,
            r['name'],
            r['path'],
            r['upstream_host'],
            r['upstream_port'],
            r['upstream_scheme'] ?? 'http',
            boolToInt(r['strip_prefix'], 1),
            boolToInt(r['websocket'], 0),
            boolToInt(r['enabled'], 1),
            r['description'] ?? null,
            typeof r['advanced_json'] === 'string'
              ? r['advanced_json']
              : JSON.stringify(r['advanced_json'] ?? {}),
            r['created_at'] ?? Date.now(),
            r['updated_at'] ?? Date.now()
          )
        }

        for (const fr of fileRoutes) {
          db.prepare(
            `INSERT OR ${orMode} INTO file_route
             (id, group_id, name, path, folder_path, index_files, dir_listing,
              try_files, spa_mode, enabled, description, advanced_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            fr['id'] ?? randomUUID(),
            fr['group_id'] ?? null,
            fr['name'],
            fr['path'],
            fr['folder_path'],
            fr['index_files'] ?? 'index.html',
            boolToInt(fr['dir_listing'], 0),
            fr['try_files'] ?? null,
            boolToInt(fr['spa_mode'], 0),
            boolToInt(fr['enabled'], 1),
            fr['description'] ?? null,
            typeof fr['advanced_json'] === 'string'
              ? fr['advanced_json']
              : JSON.stringify(fr['advanced_json'] ?? {}),
            fr['created_at'] ?? Date.now(),
            fr['updated_at'] ?? Date.now()
          )
        }
      },
      {
        summary: `CLI import (mode: ${mode}, ${groups.length} groups, ${routes.length} routes, ${fileRoutes.length} file routes)`,
        username: 'cli',
      }
    )

    console.log(`Import complete. New config version: v${result.version}.`)
  } catch (err) {
    if (err instanceof SaveError) {
      console.error(`Import failed: ${err.friendlyMessage}`)
      if (err.rawOutput) console.error(err.rawOutput)
    } else {
      console.error(`Import failed: ${(err as Error).message}`)
    }
    process.exit(1)
  } finally {
    release()
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function boolToInt(value: unknown, defaultVal: number): number {
  if (typeof value === 'boolean') return value ? 1 : 0
  if (typeof value === 'number') return value
  return defaultVal
}

function getNginxVersion(): string {
  try {
    // nginx -v writes version info to stderr
    const result = spawnSync('nginx', ['-v'], { encoding: 'utf8', timeout: 3000 })
    const output = (result.stderr || result.stdout || '') as string
    return output.trim() || 'unknown'
  } catch {
    return 'unknown'
  }
}

function printUsage(): void {
  console.log(`
unginx — recovery and management CLI

Usage: unginx <command> [options]

Commands:
  reset-password [--user <username>] [--password <password>]
      Reset the admin user's password. Runs interactively if flags are
      omitted (prompts for username and password with masked input).

  reset-admin-path
      Reset the admin UI path back to the default (${DEFAULT_ADMIN_PATH}).
      Use this when you've forgotten or misconfigured the admin path.

  whoami
      Print the current admin path, admin username, and schema version.

  export
      Dump all groups, routes, and file routes as JSON to stdout.
      Redirect to a file to create a backup:
        docker exec unginx unginx export > backup.json

  import [--replace]
      Restore config from a JSON export piped to stdin. Triggers a full
      nginx config regeneration and reload on success.
      --replace  Delete all existing routes/groups before importing
                 (default: merge — skip rows that already exist).
      Example:
        docker exec -i unginx unginx import --replace < backup.json

Options:
  -h, --help    Show this help text.
`.trim())
}

// ─── Entry point ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const [, , command, ...args] = process.argv

  if (!command || command === '--help' || command === '-h') {
    printUsage()
    process.exit(command ? 0 : 1)
  }

  // Ensure the database schema is up to date before any operation
  runMigrations()

  switch (command) {
    case 'reset-password':
      await cmdResetPassword(args)
      break
    case 'reset-admin-path':
      await cmdResetAdminPath()
      break
    case 'whoami':
      cmdWhoami()
      break
    case 'export':
      cmdExport()
      break
    case 'import':
      await cmdImport(args)
      break
    default:
      console.error(`Unknown command: "${command}"`)
      console.error('Run "unginx --help" for a list of commands.')
      process.exit(1)
  }
}

main().catch((err: unknown) => {
  console.error('Fatal:', (err as Error).message)
  process.exit(1)
})
