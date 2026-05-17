export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const BASE = '/__unginx/api'

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Only declare a JSON content-type when we're actually sending a body —
  // Fastify's parser rejects an empty body that claims to be JSON, which
  // would otherwise break every "action" POST (logout, enable/disable, …).
  const hasBody = options?.body != null
  const headers: Record<string, string> = { ...(options?.headers as Record<string, string>) }
  if (hasBody && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  })

  if (res.status === 401) {
    // Use the same prefix as BASE so we land on the SPA's /login route
    // (BrowserRouter is mounted with basename="/__unginx").
    window.location.href = '/__unginx/login'
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return {} as T
  }

  return res.json() as Promise<T>
}
