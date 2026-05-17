import { Tooltip } from 'antd'

type Status = 'up' | 'down' | 'unknown' | 'missing'

const DOT_COLORS: Record<Status, string> = {
  up:      'var(--status-success)',
  down:    'var(--status-danger)',
  unknown: 'var(--border-strong)',
  missing: 'var(--status-warning)',
}

const DOT_LABELS: Record<Status, string> = {
  up:      'Upstream is up',
  down:    'Upstream is down',
  unknown: 'Health unknown',
  missing: 'Folder not found',
}

interface Props {
  status: Status
  disabled?: boolean
}

export function HealthDot({ status, disabled }: Props) {
  const effectiveStatus = disabled ? 'unknown' : status
  return (
    <Tooltip title={disabled ? 'Disabled' : DOT_LABELS[effectiveStatus]}>
      <span style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: disabled ? 'var(--border-strong)' : DOT_COLORS[effectiveStatus],
        flexShrink: 0,
        transition: 'background 0.2s',
      }} />
    </Tooltip>
  )
}
