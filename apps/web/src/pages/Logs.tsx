import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Card, Tabs, Button, Space, Select, Typography, Switch, Tag, Popconfirm,
  Input, Empty, message,
} from 'antd'
import {
  DownloadOutlined, DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined,
  FileTextOutlined, WarningOutlined,
} from '@ant-design/icons'
import type { SSEEvent, LogEvent } from '@unginx/shared'
import { PageHeader } from '../components/PageHeader.js'
import { useDownloadLogs, useTruncateLogs } from '../api/logs.js'
import { useSSE } from '../sse.js'
import { useAllRoutes } from '../api/routes.js'

const { Text } = Typography
const { Option } = Select

const STATUS_OPTIONS = [
  { value: '2xx', label: '2xx Success' },
  { value: '3xx', label: '3xx Redirect' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
]

function statusColor(status: number): string {
  if (status >= 500) return 'var(--status-danger)'
  if (status >= 400) return 'var(--status-warning)'
  if (status >= 300) return 'var(--status-info)'
  return 'var(--status-success)'
}

function matchesStatusFilter(status: number, filters: string[]): boolean {
  if (filters.length === 0) return true
  return filters.some((f) => {
    if (f === '2xx') return status >= 200 && status < 300
    if (f === '3xx') return status >= 300 && status < 400
    if (f === '4xx') return status >= 400 && status < 500
    if (f === '5xx') return status >= 500
    return String(status) === f
  })
}

const MAX_LOGS = 1000

export default function Logs() {
  const [activeTab, setActiveTab] = useState<'access' | 'error'>('access')
  const [logs, setLogs] = useState<LogEvent[]>([])
  const [paused, setPaused] = useState(false)
  const [filterRoute, setFilterRoute] = useState<string[]>([])
  const [filterStatus, setFilterStatus] = useState<string[]>([])
  const [filterIp, setFilterIp] = useState('')
  const logEndRef = useRef<HTMLDivElement>(null)
  const downloadLogs = useDownloadLogs()
  const truncateLogs = useTruncateLogs()
  const { data: routes = [] } = useAllRoutes()

  useSSE(useCallback((event: SSEEvent) => {
    if (event.event !== 'log') return
    if (paused) return
    if (event.data.type !== activeTab) return
    setLogs((prev) => {
      const next = [event.data, ...prev]
      return next.slice(0, MAX_LOGS)
    })
  }, [paused, activeTab]))

  // Auto-scroll to top (newest at top)
  useEffect(() => {
    logEndRef.current?.scrollIntoView()
  }, [logs.length])

  const filteredLogs = logs.filter((log) => {
    if (filterRoute.length > 0 && !filterRoute.includes(log.route_id)) return false
    if (!matchesStatusFilter(log.status, filterStatus)) return false
    if (filterIp && !log.ip.includes(filterIp)) return false
    return true
  })

  const handleTruncate = async () => {
    try {
      await truncateLogs.mutateAsync(activeTab)
      setLogs([])
      message.success(`${activeTab} log truncated`)
    } catch (err) {
      message.error('Truncate failed')
    }
  }

  const tabContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Filters bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <Select
          mode="multiple"
          placeholder="All routes"
          value={filterRoute}
          onChange={setFilterRoute}
          style={{ minWidth: 180 }}
          maxTagCount={2}
        >
          {routes.map((r) => (
            <Option key={r.id} value={r.id}>{r.name}</Option>
          ))}
        </Select>
        <Select
          mode="multiple"
          placeholder="All statuses"
          value={filterStatus}
          onChange={setFilterStatus}
          style={{ minWidth: 160 }}
          maxTagCount={2}
        >
          {STATUS_OPTIONS.map((s) => <Option key={s.value} value={s.value}>{s.label}</Option>)}
        </Select>
        <Input
          placeholder="Filter IP…"
          value={filterIp}
          onChange={(e) => setFilterIp(e.target.value)}
          style={{ width: 140 }}
          allowClear
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Space>
            <Text style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live</Text>
            <Switch
              checked={!paused}
              onChange={(v) => setPaused(!v)}
              size="small"
              checkedChildren={<PlayCircleOutlined />}
              unCheckedChildren={<PauseCircleOutlined />}
            />
          </Space>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            onClick={() => downloadLogs.mutate({ type: activeTab, lines: 10000 })}
            loading={downloadLogs.isPending}
          >
            Download
          </Button>
          <Popconfirm
            title="Truncate this log file?"
            description="All existing log entries will be cleared."
            onConfirm={handleTruncate}
            okText="Truncate"
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} size="small" danger>
              Truncate
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* Log entries */}
      <div style={{
        background: 'var(--canvas)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 8,
        height: 480,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: 12,
        padding: '8px 0',
      }}>
        {filteredLogs.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={paused ? 'Log stream paused' : 'Waiting for log events…'}
            />
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 12,
                padding: '3px 12px',
                alignItems: 'center',
                borderBottom: '1px solid var(--divider)',
              }}
            >
              <Text style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0, width: 150 }}>
                {log.ts}
              </Text>
              <Text style={{ color: 'var(--text-secondary)', flexShrink: 0, width: 100 }}>
                {log.ip}
              </Text>
              <Tag
                style={{ margin: 0, flexShrink: 0 }}
                color={log.method === 'GET' ? 'blue' : log.method === 'POST' ? 'green' : 'orange'}
              >
                {log.method}
              </Tag>
              <Text style={{ color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {log.path}
              </Text>
              <Text style={{ color: statusColor(log.status), flexShrink: 0, fontWeight: 600 }}>
                {log.status}
              </Text>
              <Text style={{ color: 'var(--text-muted)', flexShrink: 0, width: 70, textAlign: 'right' }}>
                {log.ms}ms
              </Text>
              {log.route_name !== '-' && (
                <Tag style={{ margin: 0, flexShrink: 0, maxWidth: 120 }} color="default">
                  {log.route_name}
                </Tag>
              )}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      <Text style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Showing {filteredLogs.length} of {logs.length} entries (last {MAX_LOGS} kept in memory)
      </Text>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Logs" subtitle="Live nginx access and error logs" />

      <Card
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'access' | 'error')
            setLogs([])
          }}
          items={[
            {
              key: 'access',
              label: <Space><FileTextOutlined />Access</Space>,
              children: tabContent,
            },
            {
              key: 'error',
              label: <Space><WarningOutlined />Error</Space>,
              children: tabContent,
            },
          ]}
        />
      </Card>
    </div>
  )
}
