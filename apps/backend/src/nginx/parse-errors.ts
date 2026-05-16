const KNOWN_ERRORS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [
    /host not found in upstream "([^"]+)"/,
    (m) =>
      `Couldn't resolve the upstream host "${m[1]}". Check the spelling, or use an IP address.`,
  ],
  [
    /invalid number of arguments in "proxy_pass"/,
    () =>
      'The upstream URL is malformed. This is usually a bug in unginx — please file an issue.',
  ],
  [
    /duplicate location/,
    () =>
      'Two routes have the same path. (unginx normally prevents this — please file an issue.)',
  ],
  [
    /cannot load certificate/,
    () => "Upstream is HTTPS but the server's certificate couldn't be verified.",
  ],
  [
    /unknown directive "([^"]+)"/,
    (m) =>
      `nginx encountered an unknown directive "${m[1]}". This is likely a bug in unginx — please file an issue.`,
  ],
  [
    /invalid value "([^"]+)" in "([^"]+)" directive/,
    (m) =>
      `Invalid value "${m[1]}" for directive "${m[2]}". Check your advanced configuration.`,
  ],
]

export function parseNginxErrors(rawOutput: string): string {
  for (const [pattern, messageFn] of KNOWN_ERRORS) {
    const m = rawOutput.match(pattern)
    if (m) return messageFn(m)
  }
  return 'nginx rejected the new config.'
}
