import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime.js'
import { useNavigate } from 'react-router-dom'
import { Card, Typography, Tag, Table, Button, Space, Spin, Alert } from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined, NodeIndexOutlined,
  FolderOpenOutlined, AppstoreOutlined, ReloadOutlined, FileTextOutlined,
  PlusOutlined, ClockCircleOutlined, HistoryOutlined,
} from '@ant-design/icons'
import { KpiCard } from '../components/KpiCard.js'
import { PageHeader } from '../components/PageHeader.js'
import { useDashboard, useHealthStatus } from '../api/dashboard.js'
import { useResponsive } from '../hooks/useResponsive.js'

dayjs.extend(relativeTime)

const { Text } = Typography

export default function Dashboard() {
  const navigate = useNavigate()
  const { data: dashboard, isLoading, error } = useDashboard()
  const { data: health } = useHealthStatus()
  const { sectionGap, kpiMinWidth, kpiGap } = useResponsive()

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <Alert
        message="Failed to load dashboard"
        description={error instanceof Error ? error.message : 'Unknown error'}
        type="error"
        showIcon
      />
    )
  }

  const downRoutes = [
    ...(health?.routes.filter((r) => r.status === 'down') ?? []),
    ...(health?.fileRoutes.filter((r) => r.status === 'missing') ?? []),
  ]

  const healthColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: 'Kind',
      dataIndex: 'kind',
      key: 'kind',
      render: (kind: string) => (
        <Tag color="orange">{kind === 'route' ? 'Proxy' : 'File'}</Tag>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color="red">{status}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: { kind: string }) => (
        <Button
          size="small"
          type="link"
          onClick={() => navigate(record.kind === 'route' ? '/routes' : '/files')}
        >
          View
        </Button>
      ),
    },
  ]

  const activityColumns = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      render: (v: number) => (
        <Text style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
          v{String(v).padStart(4, '0')}
        </Text>
      ),
      width: 80,
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      render: (s: string) => <Text>{s}</Text>,
    },
    {
      title: 'When',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      render: (ts: number) => (
        <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {dayjs(ts).fromNow()}
        </Text>
      ),
    },
    {
      title: 'By',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
      render: (by: string | null) => (
        <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>{by ?? '—'}</Text>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: sectionGap }}>
      <PageHeader
        title="Dashboard"
        subtitle="Overview of your nginx proxy configuration"
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
            style={{ color: 'var(--text-muted)' }}
          >
            Refresh
          </Button>
        }
      />

      {/* Status card */}
      <Card
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {dashboard.nginx.running ? (
              <CheckCircleOutlined style={{ fontSize: 24, color: 'var(--status-success)' }} />
            ) : (
              <CloseCircleOutlined style={{ fontSize: 24, color: 'var(--status-danger)' }} />
            )}
            <div>
              <Text strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>
                nginx {dashboard.nginx.running ? 'Running' : 'Stopped'}
              </Text>
              {dashboard.nginx.pid && (
                <Text style={{ color: 'var(--text-muted)', fontSize: 12, display: 'block' }}>
                  PID {dashboard.nginx.pid}
                </Text>
              )}
            </div>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 24 }}>
            <Text style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>
              Config Version
            </Text>
            <Text strong style={{ color: 'var(--text-primary)', fontSize: 20 }}>
              v{String(dashboard.configVersion).padStart(4, '0')}
            </Text>
          </div>

          <div style={{ borderLeft: '1px solid var(--border-subtle)', paddingLeft: 24 }}>
            <Text style={{ color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block' }}>
              App Version
            </Text>
            <Text strong style={{ color: 'var(--text-primary)', fontSize: 15 }}>
              {dashboard.appVersion}
            </Text>
          </div>
        </div>
      </Card>

      {/* KPI row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fit, minmax(${kpiMinWidth}px, 1fr))`,
        gap: kpiGap,
      }}>
        <KpiCard
          title="Proxy Routes"
          value={dashboard.counts.routes.total}
          suffix={`/ ${dashboard.counts.routes.enabled} enabled`}
          icon={<NodeIndexOutlined />}
          accentType="primary"
        />
        <KpiCard
          title="File Routes"
          value={dashboard.counts.fileRoutes.total}
          suffix={`/ ${dashboard.counts.fileRoutes.enabled} enabled`}
          icon={<FolderOpenOutlined />}
          accentType="secondary"
        />
        <KpiCard
          title="Groups"
          value={dashboard.counts.groups}
          icon={<AppstoreOutlined />}
          accentType="info"
        />
        <KpiCard
          title="Config Version"
          value={`v${String(dashboard.configVersion).padStart(4, '0')}`}
          icon={<ClockCircleOutlined />}
          accentType="success"
        />
      </div>

      {/* Health summary — only show when there are down routes */}
      {downRoutes.length > 0 && (
        <Card
          title={
            <Space>
              <CloseCircleOutlined style={{ color: 'var(--status-danger)' }} />
              <span>Unhealthy Routes</span>
              <Tag color="red">{downRoutes.length}</Tag>
            </Space>
          }
          style={{ background: 'var(--surface)', border: '1px solid var(--status-danger)', borderRadius: 12 }}
          styles={{
            header: { borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' },
            body: { padding: 0 },
          }}
        >
          <Table
            dataSource={downRoutes}
            columns={healthColumns}
            rowKey="id"
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {/* Recent Activity */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined style={{ color: 'var(--accent-primary)' }} />
            <span>Recent Activity</span>
          </Space>
        }
        extra={
          <Button type="link" size="small" onClick={() => navigate('/history')}>
            View all
          </Button>
        }
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}
        styles={{
          header: { borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' },
          body: { padding: 0 },
        }}
      >
        <Table
          dataSource={dashboard.recentActivity}
          columns={activityColumns}
          rowKey="version"
          size="small"
          pagination={false}
          style={{ background: 'var(--surface)' }}
        />
      </Card>

      {/* Quick actions */}
      <Card
        title="Quick Actions"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}
        styles={{ header: { borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } }}
      >
        <Space size="middle" wrap>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/routes')}
          >
            New Route
          </Button>
          <Button
            icon={<PlusOutlined />}
            onClick={() => navigate('/files')}
          >
            New File Route
          </Button>
          <Button
            icon={<FileTextOutlined />}
            onClick={() => navigate('/logs')}
          >
            Open Logs
          </Button>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => navigate('/history')}
          >
            View History
          </Button>
        </Space>
      </Card>
    </div>
  )
}
