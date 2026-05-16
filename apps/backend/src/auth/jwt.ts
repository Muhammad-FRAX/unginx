import { SignJWT, jwtVerify } from 'jose'
import type { JWTPayload } from 'jose'
import db from '../db/client.js'
import { JWT_EXPIRY_DAYS } from '@unginx/shared'

export interface JwtClaims extends JWTPayload {
  username: string
}

function getSecret(): Uint8Array {
  const row = db
    .prepare('SELECT value FROM setting WHERE key = ?')
    .get('jwt_secret') as { value: string } | undefined
  if (!row) throw new Error('jwt_secret not found in settings')
  return new TextEncoder().encode(row.value)
}

export async function signToken(userId: number, username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${JWT_EXPIRY_DAYS}d`)
    .sign(getSecret())
}

export async function verifyToken(token: string): Promise<JwtClaims> {
  const { payload } = await jwtVerify(token, getSecret())
  return payload as JwtClaims
}
