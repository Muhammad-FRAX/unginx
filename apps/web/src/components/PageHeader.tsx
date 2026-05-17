import { Typography, Space } from 'antd'
import type { ReactNode } from 'react'

const { Title, Text } = Typography

interface Props {
  title: string
  subtitle?: string
  extra?: ReactNode
}

export function PageHeader({ title, subtitle, extra }: Props) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Space direction="vertical" size={4}>
          <Title level={2} style={{ margin: 0, color: 'var(--text-primary)' }}>{title}</Title>
          {subtitle && (
            <Text style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{subtitle}</Text>
          )}
        </Space>
        {extra && <div>{extra}</div>}
      </div>
    </div>
  )
}
