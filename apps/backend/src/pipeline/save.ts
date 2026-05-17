import fs from 'fs'
import path from 'path'
import db from '../db/client.js'
import { renderConfig, type RenderResult } from '../nginx/render.js'
import { runNginxTest } from '../nginx/test.js'
import { reloadNginx } from '../nginx/reload.js'
import { parseNginxErrors } from '../nginx/parse-errors.js'
import { sseBus } from '../sse/bus.js'
import {
  ACTIVE_DIR,
  STAGING_DIR,
  VERSIONS_DIR,
  DEFAULT_ADMIN_PATH,
  VERSION_MAX_COUNT,
  VERSION_MAX_AGE_DAYS,
} from '@unginx/shared'
import type { Route, FileRoute, AdvancedJson } from '@unginx/shared'

// ─── DB row types (SQLite stores booleans as integers) ─────────────────────

interface DbRoute {
  id: string
  group_id: string | null
  name: string
  path: string
  upstream_host: string
  upstream_port: number
  upstream_scheme: string
  strip_prefix: number
  websocket: number
  enabled: number
  description: string | null
  advanced_json: string
  created_at: number
  updated_at: number
}

interface DbFileRoute {
  id: string
  group_id: string | null
  name: string
  path: string
  folder_path: string
  index_files: string
  dir_listing: number
  try_files: string | null
  spa_mode: number
  enabled: number
  description: string | null
  advanced_json: string
  created_at: number
  updated_at: number
}

// ─── Error class ────────────────────────────────────────────────────────────

export class SaveError extends Error {
  constructor(
    message: string,
    public readonly friendlyMessage: string,
    public readonly rawOutput?: string
  ) {
    super(message)
    this.name = 'SaveError'
  }
}

// ─── DB row mappers ─────────────────────────────────────────────────────────

function mapDbRoute(r: DbRoute): Route {
  return {
    ...r,
    strip_prefix: r.strip_prefix === 1,
    websocket: r.websocket === 1,
    enabled: r.enabled === 1,
    upstream_scheme: r.upstream_scheme as 'http' | 'https',
    advanced_json: parseJson(r.advanced_json),
  }
}

function mapDbFileRoute(fr: DbFileRoute): FileRoute {
  return {
    ...fr,
    dir_listing: fr.dir_listing === 1,
    spa_mode: fr.spa_mode === 1,
    enabled: fr.enabled === 1,
    advanced_json: parseJson(fr.advanced_json),
  }
}

function parseJson(s: string): AdvancedJson {
  try {
    return JSON.parse(s || '{}') as AdvancedJson
  } catch {
    return {}
  }
}

// ─── State loading ───────────────────────────────────────────────────────────

function loadState(): { routes: Route[]; fileRoutes: FileRoute[] } {
  const routes = (db.prepare('SELECT * FROM route').all() as DbRoute[]).map(
    mapDbRoute
  )
  const fileRoutes = (
    db.prepare('SELECT * FROM file_route').all() as DbFileRoute[]
  ).map(mapDbFileRoute)
  return { routes, fileRoutes }
}

// ─── Path uniqueness check ───────────────────────────────────────────────────

export function checkPathUniqueness(): void {
  const adminPath =
    (
      db
        .prepare('SELECT value FROM setting WHERE key = ?')
        .get('admin_path') as { value: string } | undefined
    )?.value ?? DEFAULT_ADMIN_PATH

  const enabledRoutes = db
    .prepare('SELECT id, path FROM route WHERE enabled = 1')
    .all() as Array<{ id: string; path: string }>

  const enabledFileRoutes = db
    .prepare('SELECT id, path FROM file_route WHERE enabled = 1')
    .all() as Array<{ id: string; path: string }>

  const seen = new Map<string, string>()

  for (const r of enabledRoutes) {
    if (r.path === adminPath || r.path.startsWith(`${adminPath}/`)) {
      throw new SaveError(
        `Route path "${r.path}" conflicts with admin path`,
        `Path "${r.path}" conflicts with the admin path (${adminPath}). Choose a different path.`
      )
    }
    const existing = seen.get(r.path)
    if (existing) {
      throw new SaveError(
        `Duplicate path: ${r.path}`,
        `A route with path "${r.path}" already exists. Disable or delete it before creating another.`
      )
    }
    seen.set(r.path, `route:${r.id}`)
  }

  for (const fr of enabledFileRoutes) {
    if (fr.path === adminPath || fr.path.startsWith(`${adminPath}/`)) {
      throw new SaveError(
        `File route path "${fr.path}" conflicts with admin path`,
        `Path "${fr.path}" conflicts with the admin path (${adminPath}). Choose a different path.`
      )
    }
    const existing = seen.get(fr.path)
    if (existing) {
      throw new SaveError(
        `Duplicate path: ${fr.path}`,
        `A route with path "${fr.path}" already exists. Disable or delete it before creating another.`
      )
    }
    seen.set(fr.path, `file_route:${fr.id}`)
  }
}

// ─── Filesystem helpers ──────────────────────────────────────────────────────

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function writeFragments(dir: string, fragments: RenderResult): void {
  ensureDir(dir)
  for (const [name, content] of Object.entries(fragments)) {
    fs.writeFileSync(path.join(dir, name), content, 'utf8')
  }
}

function copyDir(src: string, dest: string): void {
  ensureDir(dest)
  if (!fs.existsSync(src)) return
  for (const entry of fs.readdirSync(src)) {
    fs.copyFileSync(path.join(src, entry), path.join(dest, entry))
  }
}

// ─── Version management ──────────────────────────────────────────────────────

function getNextVersion(): number {
  const row = db
    .prepare('SELECT COALESCE(MAX(version), 0) as v FROM config_version')
    .get() as { v: number }
  return row.v + 1
}

function insertVersion(
  version: number,
  summary: string,
  state: { routes: Route[]; fileRoutes: FileRoute[] },
  username: string | null
): void {
  const snapshot = JSON.stringify({
    routes: state.routes,
    fileRoutes: state.fileRoutes,
    exportedAt: new Date().toISOString(),
  })
  db.prepare(
    'INSERT INTO config_version (version, summary, db_snapshot_json, created_at, created_by) VALUES (?, ?, ?, ?, ?)'
  ).run(version, summary, snapshot, Date.now(), username)
  pruneVersions()
}

function pruneVersions(): void {
  const maxAgeMs = VERSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const cutoffTs = Date.now() - maxAgeMs

  const keepIds = (
    db
      .prepare(
        'SELECT id FROM config_version ORDER BY version DESC LIMIT ?'
      )
      .all(VERSION_MAX_COUNT) as Array<{ id: number }>
  ).map((r) => r.id)

  if (keepIds.length === 0) return

  // Delete versions beyond count limit AND older than retention window
  db.prepare(
    `DELETE FROM config_version WHERE id NOT IN (${keepIds.map(() => '?').join(',')}) AND created_at < ?`
  ).run(...keepIds, cutoffTs)
}

// ─── In-process save lock ────────────────────────────────────────────────────
// Single-process guarantee: only one save pipeline runs at a time.
// A proper flock on STAGING_LOCK could be layered on top for CLI safety.

let pipelineLocked = false
const pipelineQueue: Array<() => void> = []

async function acquirePipelineLock(): Promise<() => void> {
  if (!pipelineLocked) {
    pipelineLocked = true
    return doRelease
  }
  return new Promise((resolve) => {
    pipelineQueue.push(() => {
      pipelineLocked = true
      resolve(doRelease)
    })
  })
}

function doRelease(): void {
  const next = pipelineQueue.shift()
  if (next) {
    next()
  } else {
    pipelineLocked = false
  }
}

// ─── Save pipeline ───────────────────────────────────────────────────────────

export interface SaveOptions {
  summary: string
  username: string | null
  /** Skip nginx operations for changes that don't affect routing (e.g. group rename). */
  skipNginxReload?: boolean
}

/**
 * The core save pipeline — phases 1–14 from plan.md §11.
 *
 * @param mutate  Synchronous callback that applies the DB mutation (INSERT / UPDATE / DELETE).
 *                Called inside an IMMEDIATE transaction; throw to abort.
 * @param opts    Pipeline options.
 */
export async function runSavePipeline(
  mutate: () => void,
  opts: SaveOptions
): Promise<{ version: number }> {
  // Step 1: Acquire lock (queues concurrent calls)
  const release = await acquirePipelineLock()

  try {
    // Step 2: BEGIN IMMEDIATE transaction — holds write lock for the duration
    db.exec('BEGIN IMMEDIATE')

    try {
      // Step 3: Apply mutation
      mutate()

      // Step 4: Uniqueness checks
      checkPathUniqueness()

      if (opts.skipNginxReload) {
        // Path for non-nginx changes (group renames, etc.)
        const state = loadState()
        const version = getNextVersion()
        insertVersion(version, opts.summary, state, opts.username)
        db.exec('COMMIT')
        sseBus.broadcast({
          event: 'config-changed',
          data: { version, summary: opts.summary },
        })
        return { version }
      }

      // Step 5: Render fragments to /data/staging/
      const state = loadState()
      const fragments = renderConfig(state, STAGING_DIR)
      writeFragments(STAGING_DIR, fragments)

      // Step 6: nginx -t against staging config
      const testResult = await runNginxTest()
      if (!testResult.ok) {
        db.exec('ROLLBACK')
        throw new SaveError(
          `nginx -t failed: ${testResult.rawOutput}`,
          parseNginxErrors(testResult.rawOutput),
          testResult.rawOutput
        )
      }

      // Step 7: Snapshot current /data/active/ → /data/versions/vNNNN/
      const version = getNextVersion()
      const versionDir = path.join(
        VERSIONS_DIR,
        `v${String(version).padStart(4, '0')}`
      )
      ensureDir(VERSIONS_DIR)
      copyDir(ACTIVE_DIR, versionDir)

      // Step 8: Atomic swap — rename active → backup, staging → active
      const activeBackup = `${ACTIVE_DIR}.old.${Date.now()}`
      if (fs.existsSync(ACTIVE_DIR)) {
        fs.renameSync(ACTIVE_DIR, activeBackup)
      }
      fs.renameSync(STAGING_DIR, ACTIVE_DIR)

      // Step 9: SIGHUP nginx
      const reloadResult = await reloadNginx()

      if (!reloadResult.ok) {
        // Step 10: Auto-revert — restore previous active config
        const brokenPath = `${STAGING_DIR}.broken.${Date.now()}`
        if (fs.existsSync(ACTIVE_DIR)) {
          fs.renameSync(ACTIVE_DIR, brokenPath)
        }
        if (fs.existsSync(activeBackup)) {
          fs.renameSync(activeBackup, ACTIVE_DIR)
        }
        // Re-signal nginx to reload with the restored config
        await reloadNginx()

        db.exec('ROLLBACK')
        throw new SaveError(
          `nginx refused reload: ${reloadResult.error}`,
          'nginx refused the reload — your previous config is still live.',
          reloadResult.error
        )
      }

      // Clean up the backup now that nginx confirmed the reload
      if (fs.existsSync(activeBackup)) {
        fs.rmSync(activeBackup, { recursive: true, force: true })
      }

      // Step 11: COMMIT, Step 12: INSERT config_version
      insertVersion(version, opts.summary, state, opts.username)
      db.exec('COMMIT')

      // Step 13: Release lock (happens in finally)

      // Step 14: Broadcast SSE config-changed
      sseBus.broadcast({
        event: 'config-changed',
        data: { version, summary: opts.summary },
      })

      return { version }
    } catch (err) {
      // Roll back if still in a transaction
      try {
        db.exec('ROLLBACK')
      } catch {
        // Already rolled back or committed — ignore
      }
      throw err
    }
  } finally {
    release()
  }
}
