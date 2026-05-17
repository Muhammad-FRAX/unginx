import { Card, Typography } from 'antd'
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import type { ReactNode } from 'react'

const { Text } = Typography

const ACCENTS = {
  primary:   { bg: 'var(--accent-primary-soft)',   fg: 'var(--accent-primary)'   },
  secondary: { bg: 'var(--accent-secondary-soft)', fg: 'var(--accent-secondary)' },
  info:      { bg: 'rgba(56,189,248,0.12)',          fg: 'var(--status-info)'      },
  success:   { bg: 'rgba(34,197,94,0.12)',           fg: 'var(--status-success)'   },
}

interface Props {
  title: string
  value: number | string
  prefix?: string
  suffix?: string
  precision?: number
  trend?: number
  trendLabel?: string
  loading?: boolean
  icon?: ReactNode
  accentType?: 'primary' | 'secondary' | 'info' | 'success'
}

export function KpiCard({
  title, value, prefix, suffix, precision = 0,
  trend, trendLabel = 'vs last period',
  loading = false, icon, accentType = 'primary',
}: Props) {
  const isUp = trend !== undefined && trend >= 0
  const accent = ACCENTS[accentType]

  return (
    <Card
      loading={loading}
      style={{
        height: '100%',
        background: 'var(--elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        transition: 'all 0.2s ease',
      }}
      styles={{ body: { padding: '16px 18px' } }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(-2px)'
        el.style.boxShadow = '0 6px 20px rgba(59,130,246,0.15)'
        el.style.borderColor = 'var(--accent-primary)'
        el.style.background = 'var(--hover)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement
        el.style.transform = 'translateY(0)'
        el.style.boxShadow = 'none'
        el.style.borderColor = 'var(--border-subtle)'
        el.style.background = 'var(--elevated)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {icon && (
          <div style={{
            width: 36, height: 36, borderRadius: 8,
            background: accent.bg, color: accent.fg,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, flexShrink: 0,
          }}>{icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text style={{
            fontSize: 11, fontWeight: 500,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase', letterSpacing: '0.8px',
            display: 'block', marginBottom: 6,
          }}>{title}</Text>

          <div style={{
            fontSize: 28, fontWeight: 700, lineHeight: 1.2,
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
            marginBottom: trend !== undefined ? 6 : 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {prefix}
            {typeof value === 'number' ? value.toFixed(precision) : value}
            {suffix && (
              <span style={{ fontSize: 16, fontWeight: 500, marginLeft: 4, color: 'var(--text-secondary)' }}>
                {suffix}
              </span>
            )}
          </div>

          {trend !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Text style={{
                color: isUp ? 'var(--status-success)' : 'var(--status-danger)',
                fontSize: 11, fontWeight: 600,
              }}>
                {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(trend).toFixed(1)}%
              </Text>
              <Text style={{ fontSize: 10, color: 'var(--text-muted)' }}>{trendLabel}</Text>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
