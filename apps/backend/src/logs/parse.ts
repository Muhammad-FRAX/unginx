/**
 * Parses lines from nginx's unginx_combined log format:
 *
 *   $remote_addr - $remote_user [$time_local] "$request" $status $body_bytes_sent
 *   "$http_referer" "$http_user_agent" rid=$unginx_route_id rt=$request_time
 */

import type { LogEvent } from '@unginx/shared'

// Precompiled regex for the unginx_combined log format
const ACCESS_RE =
  /^(\S+) - \S+ \[([^\]]+)\] "(\S+) (\S+) [^"]*" (\d+) \d+ "[^"]*" "[^"]*" rid=(\S+) rt=(\S+)/

export function parseAccessLine(
  line: string,
  routeNames: Map<string, string>
): LogEvent | null {
  const m = ACCESS_RE.exec(line)
  if (!m) return null

  const [, ip, timeLocal, method, path, statusStr, routeId, rtStr] = m as unknown as [
    string, string, string, string, string, string, string, string
  ]

  const status = parseInt(statusStr, 10)
  const ms = Math.round(parseFloat(rtStr) * 1000)
  const ts = parseTimeLocal(timeLocal)

  return {
    ts,
    ip,
    method,
    path,
    status,
    route_id: routeId,
    route_name: routeId === '-' ? '-' : (routeNames.get(routeId) ?? routeId),
    ms,
    type: 'access',
  }
}

export function parseErrorLine(line: string): LogEvent | null {
  // nginx error lines start with: 2026/05/16 14:22:08 [error] ...
  const m = /^(\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]/.exec(line)
  if (!m) return null

  const ts = new Date(m[1].replace(/\//g, '-').replace(' ', 'T')).toISOString()

  return {
    ts,
    ip: '-',
    method: '-',
    path: line,
    status: 0,
    route_id: '-',
    route_name: '-',
    ms: 0,
    type: 'error',
  }
}

// Converts nginx's time_local format (e.g. "16/May/2026:14:22:08 +0000") to ISO string
function parseTimeLocal(s: string): string {
  // "16/May/2026:14:22:08 +0000"
  const m = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{4})$/.exec(s)
  if (!m) return new Date().toISOString()
  const [, day, mon, year, time, tz] = m
  const tzFormatted = `${tz.slice(0, 3)}:${tz.slice(3)}`
  return new Date(`${year}-${monthIndex(mon)}-${day}T${time}${tzFormatted}`).toISOString()
}

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

function monthIndex(abbr: string): string {
  return MONTHS[abbr] ?? '01'
}
