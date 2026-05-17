import { useState } from 'react'
import { Table, Button, Modal, Typography, Space, Popconfirm, message, Spin, Descriptions } from 'antd'
import { EyeOutlined, RollbackOutlined, PlusOutlined, MinusOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { PageHeader } from '../components/PageHeader.js'
import { useVersions, useVersionDetail, useRollback } from '../api/history.js'
import type { VersionSummary } from '../api/history.js'

const { Text, Title } = Typography

export default function History() {
  const { data: versions = [], isLoading } = useVersions()
  const rollback = useRollback()
  const [viewVersion, setViewVersion] = useState<number | null>(null)
  const { data: versionDetail } = useVersionDetail(viewVersion)

  const handleRollback = async (v: number) => {
    try {
      const result = await rollback.mutateAsync(v)
      message.success(`Rolled back to v${String(v).padStart(4, '0')} — new version is v${String(result.newVersion).padStart(4, '0')}`)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Rollback failed')
    }
  }

  const columns = [
    {
      title: 'Version',
      dataIndex: 'version',
      key: 'version',
      width: 90,
      render: (v: number) => (
        <Text style={{ color: 'var(--accent-primary)', fontWeight: 600, fontFamily: 'monospace' }}>
          v{String(v).padStart(4, '0')}
        </Text>
      ),
    },
    {
      title: 'When',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (ts: number) => (
        <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {dayjs(ts).format('YYYY-MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: 'By',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 100,
      render: (by: string | null) => <Text style={{ color: 'var(--text-secondary)' }}>{by ?? '—'}</Text>,
    },
    {
      title: 'Summary',
      dataIndex: 'summary',
      key: 'summary',
      render: (s: string) => <Text>{s}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_: unknown, record: VersionSummary, index: number) => (
        <Space size="small">
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setViewVersion(record.version)}
          >
            View
          </Button>
          {index > 0 && (
            <Popconfirm
              title={`Roll back to v${String(record.version).padStart(4, '0')}?`}
              description="This will restore the config from this version and create a new version entry."
              onConfirm={() => handleRollback(record.version)}
              okText="Rollback"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" icon={<RollbackOutlined />} loading={rollback.isPending}>
                Rollback
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="History"
        subtitle="Config version history — rollback to any previous state"
      />

      <div style={{
        background: 'var(--elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
      }}>
        <Table
          dataSource={versions}
          columns={columns}
          rowKey="version"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} versions` }}
          size="middle"
          scroll={{ x: 'max-content' }}
        />
      </div>

      {/* Version detail modal */}
      <Modal
        title={`Version v${String(viewVersion ?? 0).padStart(4, '0')}`}
        open={viewVersion !== null}
        onCancel={() => setViewVersion(null)}
        footer={null}
        width={700}
        styles={{
          content: { background: 'var(--elevated)', border: '1px solid var(--border-subtle)' },
          header: { background: 'var(--elevated)', borderBottom: '1px solid var(--border-subtle)' },
          body: { background: 'var(--elevated)' },
          mask: { background: 'rgba(0,0,0,0.55)' },
        }}
      >
        {!versionDetail ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Version">
                <Text style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                  v{String(versionDetail.version).padStart(4, '0')}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {dayjs(versionDetail.created_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="By">{versionDetail.created_by ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="Summary" span={2}>{versionDetail.summary}</Descriptions.Item>
            </Descriptions>

            {/* Diff summary */}
            <Title level={5} style={{ margin: 0, color: 'var(--text-primary)' }}>Changes</Title>
            {versionDetail.diff.added.length === 0 && versionDetail.diff.removed.length === 0 && versionDetail.diff.changed.length === 0 ? (
              <Text style={{ color: 'var(--text-muted)' }}>No route changes in this version.</Text>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {versionDetail.diff.added.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid var(--status-success)',
                  }}>
                    <PlusOutlined style={{ color: 'var(--status-success)' }} />
                    <Text style={{ color: 'var(--text-primary)' }}>Added: {(item as { name?: string; path?: string }).name ?? (item as { path?: string }).path}</Text>
                  </div>
                ))}
                {versionDetail.diff.removed.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: 'rgba(220,38,38,0.08)',
                    border: '1px solid var(--status-danger)',
                  }}>
                    <MinusOutlined style={{ color: 'var(--status-danger)' }} />
                    <Text style={{ color: 'var(--text-primary)' }}>Removed: {(item as { name?: string; path?: string }).name ?? (item as { path?: string }).path}</Text>
                  </div>
                ))}
                {versionDetail.diff.changed.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 10px', borderRadius: 6,
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid var(--accent-primary)',
                  }}>
                    <EditOutlined style={{ color: 'var(--accent-primary)' }} />
                    <Text style={{ color: 'var(--text-primary)' }}>
                      Changed: {((item as { after?: { name?: string } }).after?.name) ?? '—'}
                    </Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
