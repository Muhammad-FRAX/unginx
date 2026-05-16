export const lightTokens = {
  canvas:               '#F4F6FA',
  shell:                '#EEF2F7',
  section:              '#FFFFFF',
  divider:              '#E2E8F0',
  surface:              '#FFFFFF',
  elevated:             '#F9FAFC',
  hover:                '#EFF4FF',
  borderSubtle:         '#CBD5E1',
  borderStrong:         '#94A3B8',
  textPrimary:          '#0B1220',
  textSecondary:        '#1F2937',
  textMuted:            '#64748B',
  textInverse:          '#FFFFFF',
  accentPrimary:        '#1E40AF',
  accentPrimarySoft:    '#E0EAFF',
  accentSecondary:      '#14B8A6',
  accentSecondarySoft:  '#E6FAF6',
  statusSuccess:        '#16A34A',
  statusWarning:        '#F97316',
  statusDanger:         '#DC2626',
  statusInfo:           '#0EA5E9',
} as const

export const darkTokens = {
  canvas:               '#0B0F1A',
  shell:                '#111827',
  section:              '#1F2937',
  divider:              '#27324A',
  surface:              '#1A2233',
  elevated:             '#222C42',
  hover:                '#2A3550',
  borderSubtle:         '#334155',
  borderStrong:         '#475569',
  textPrimary:          '#F5F7FA',
  textSecondary:        '#CBD5E1',
  textMuted:            '#94A3B8',
  textInverse:          '#0B0F1A',
  accentPrimary:        '#3B82F6',
  accentPrimarySoft:    '#0F2447',
  accentSecondary:      '#2DD4BF',
  accentSecondarySoft:  '#0F2A29',
  statusSuccess:        '#22C55E',
  statusWarning:        '#FB923C',
  statusDanger:         '#F87171',
  statusInfo:           '#38BDF8',
} as const

export type TokenMap = typeof lightTokens

function tokensToCssVars(tokens: TokenMap): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) {
    const cssVar = `--${key.replace(/([A-Z])/g, (m) => `-${m.toLowerCase()}`)}`
    vars[cssVar] = value
  }
  return vars
}

export function applyTheme(mode: 'light' | 'dark') {
  const tokens = mode === 'dark' ? darkTokens : lightTokens
  const vars = tokensToCssVars(tokens)
  const root = document.documentElement
  root.setAttribute('data-theme', mode)
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value)
  }
}

export function getSystemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const THEME_STORAGE_KEY = 'unginx.theme'
