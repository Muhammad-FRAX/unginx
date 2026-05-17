export const DEFAULT_ADMIN_PATH = '/__unginx'
export const DEFAULT_USERNAME = 'unginx'
export const DEFAULT_PASSWORD = 'unginx'
export const SOCKET_PATH = '/run/unginx/backend.sock'

export const DATA_DIR = '/data'
export const DB_PATH = `${DATA_DIR}/db/unginx.sqlite`
export const ACTIVE_DIR = `${DATA_DIR}/active`
export const STAGING_DIR = `${DATA_DIR}/staging`
export const VERSIONS_DIR = `${DATA_DIR}/versions`
export const LOGS_DIR = `${DATA_DIR}/logs`
export const STAGING_LOCK = `${DATA_DIR}/staging.lock`

export const JWT_EXPIRY_DAYS = 30
export const HEALTH_CHECK_INTERVAL_MS = 30_000
export const LOG_ROTATE_INTERVAL_MS = 60_000
export const LOG_MAX_SIZE_MB = 50
export const LOG_MAX_ROTATIONS = 10
export const LOG_MAX_AGE_DAYS = 14
export const VERSION_MAX_COUNT = 100
export const VERSION_MAX_AGE_DAYS = 30

export const BRUTE_FORCE_MAX_ATTEMPTS = 5
export const BRUTE_FORCE_WINDOW_MS = 15 * 60 * 1000
export const BRUTE_FORCE_LOCKOUT_MS = 30 * 1000

export const NGINX_PID_FILE = '/run/nginx/nginx.pid'
export const NGINX_STAGING_PORT = 18080
