import { spawn } from 'child_process'
import path from 'path'
import { STAGING_DIR } from '@unginx/shared'

export interface NginxTestResult {
  ok: boolean
  rawOutput: string
}

export async function runNginxTest(
  configPath?: string
): Promise<NginxTestResult> {
  const confPath = configPath ?? path.join(STAGING_DIR, 'nginx.conf')

  return new Promise((resolve) => {
    const child = spawn('nginx', ['-t', '-c', confPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let rawOutput = ''
    child.stdout.on('data', (chunk: Buffer) => {
      rawOutput += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      rawOutput += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({ ok: code === 0, rawOutput })
    })

    child.on('error', (err) => {
      resolve({
        ok: false,
        rawOutput: `Failed to spawn nginx: ${err.message}`,
      })
    })
  })
}

export async function runNginxTestOnActive(): Promise<NginxTestResult> {
  return new Promise((resolve) => {
    const child = spawn('nginx', ['-t'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let rawOutput = ''
    child.stdout.on('data', (chunk: Buffer) => {
      rawOutput += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      rawOutput += chunk.toString()
    })

    child.on('close', (code) => {
      resolve({ ok: code === 0, rawOutput })
    })

    child.on('error', (err) => {
      resolve({
        ok: false,
        rawOutput: `Failed to spawn nginx: ${err.message}`,
      })
    })
  })
}
