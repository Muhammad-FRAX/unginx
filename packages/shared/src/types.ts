export type Theme = 'light' | 'dark' | 'system'

export type RouteKind = 'proxy' | 'file'

export type HealthStatus = 'up' | 'down' | 'unknown' | 'missing'

export type UpstreamScheme = 'http' | 'https'

export interface AdvancedJson {
  client_max_body_size_mb?: number
  proxy_read_timeout_s?: number
  proxy_connect_timeout_s?: number
  request_headers?: Array<{ name: string; value: string }>
  response_headers?: Array<{ name: string; value: string }>
  rate_limit_req_per_sec?: number
}

export interface Route {
  id: string
  group_id: string | null
  name: string
  path: string
  upstream_host: string
  upstream_port: number
  upstream_scheme: UpstreamScheme
  strip_prefix: boolean
  websocket: boolean
  enabled: boolean
  description: string | null
  advanced_json: AdvancedJson
  created_at: number
  updated_at: number
}

export interface FileRoute {
  id: string
  group_id: string | null
  name: string
  path: string
  folder_path: string
  index_files: string
  dir_listing: boolean
  try_files: string | null
  spa_mode: boolean
  enabled: boolean
  description: string | null
  advanced_json: AdvancedJson
  created_at: number
  updated_at: number
}

export interface Group {
  id: string
  kind: RouteKind
  name: string
  description: string | null
  created_at: number
}

export interface ConfigVersion {
  id: number
  version: number
  summary: string
  db_snapshot_json: string
  created_at: number
  created_by: string | null
}

export interface User {
  id: number
  username: string
  must_change_password: boolean
  created_at: number
  updated_at: number
}

export interface HealthEvent {
  kind: 'route' | 'file_route'
  id: string
  status: HealthStatus
}

export interface LogEvent {
  ts: string
  ip: string
  method: string
  path: string
  status: number
  route_id: string
  route_name: string
  ms: number
  type: 'access' | 'error'
}

export interface ConfigChangedEvent {
  version: number
  summary: string
}

export interface NginxStatusEvent {
  running: boolean
  lastReloadAt: string | null
}

export type SSEEvent =
  | { event: 'health'; data: HealthEvent }
  | { event: 'log'; data: LogEvent }
  | { event: 'config-changed'; data: ConfigChangedEvent }
  | { event: 'nginx-status'; data: NginxStatusEvent }
  | { event: 'ping'; data: Record<string, never> }
