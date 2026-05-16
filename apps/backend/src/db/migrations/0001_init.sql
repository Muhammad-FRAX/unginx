-- v0001 initial schema

CREATE TABLE IF NOT EXISTS setting (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user (
  id                   INTEGER PRIMARY KEY,
  username             TEXT NOT NULL UNIQUE,
  password_hash        TEXT NOT NULL,
  must_change_password INTEGER NOT NULL DEFAULT 0,
  created_at           INTEGER NOT NULL,
  updated_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_ (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('proxy','file')),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  INTEGER NOT NULL,
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS route (
  id              TEXT PRIMARY KEY,
  group_id        TEXT REFERENCES group_(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  path            TEXT NOT NULL,
  upstream_host   TEXT NOT NULL,
  upstream_port   INTEGER NOT NULL CHECK (upstream_port BETWEEN 1 AND 65535),
  upstream_scheme TEXT NOT NULL DEFAULT 'http' CHECK (upstream_scheme IN ('http','https')),
  strip_prefix    INTEGER NOT NULL DEFAULT 1,
  websocket       INTEGER NOT NULL DEFAULT 0,
  enabled         INTEGER NOT NULL DEFAULT 1,
  description     TEXT,
  advanced_json   TEXT NOT NULL DEFAULT '{}',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS file_route (
  id            TEXT PRIMARY KEY,
  group_id      TEXT REFERENCES group_(id) ON DELETE SET NULL,
  name          TEXT NOT NULL,
  path          TEXT NOT NULL,
  folder_path   TEXT NOT NULL,
  index_files   TEXT NOT NULL DEFAULT 'index.html',
  dir_listing   INTEGER NOT NULL DEFAULT 0,
  try_files     TEXT,
  spa_mode      INTEGER NOT NULL DEFAULT 0,
  enabled       INTEGER NOT NULL DEFAULT 1,
  description   TEXT,
  advanced_json TEXT NOT NULL DEFAULT '{}',
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS config_version (
  id               INTEGER PRIMARY KEY,
  version          INTEGER NOT NULL UNIQUE,
  summary          TEXT NOT NULL,
  db_snapshot_json TEXT NOT NULL,
  created_at       INTEGER NOT NULL,
  created_by       TEXT
);

CREATE INDEX IF NOT EXISTS idx_route_enabled_path      ON route(path) WHERE enabled = 1;
CREATE INDEX IF NOT EXISTS idx_file_route_enabled_path ON file_route(path) WHERE enabled = 1;
CREATE INDEX IF NOT EXISTS idx_route_group             ON route(group_id);
CREATE INDEX IF NOT EXISTS idx_file_route_group        ON file_route(group_id);
