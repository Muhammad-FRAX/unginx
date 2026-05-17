export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

const BASE = '/__unginx/api'

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })

  if (res.status === 401) {
    window.location.href = '/login'
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
