import type { FastifyRequest, FastifyReply } from 'fastify'

export function parseCookies(request: FastifyRequest): Record<string, string> {
  const header = request.headers['cookie']
  if (!header) return {}
  return Object.fromEntries(
    header.split(';').flatMap((part) => {
      const idx = part.indexOf('=')
      if (idx === -1) return []
      const key = part.slice(0, idx).trim()
      const val = part.slice(idx + 1).trim()
      return key ? [[key, val]] : []
    })
  )
}

export function setCookie(
  reply: FastifyReply,
  name: string,
  value: string,
  options: { httpOnly?: boolean; sameSite?: string; secure?: boolean; path?: string }
): void {
  const parts = [`${name}=${value}`]
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.httpOnly) parts.push('HttpOnly')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.secure) parts.push('Secure')
  reply.header('Set-Cookie', parts.join('; '))
}

export function clearCookie(reply: FastifyReply, name: string, path: string): void {
  reply.header(
    'Set-Cookie',
    `${name}=; Path=${path}; HttpOnly; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
  )
}
