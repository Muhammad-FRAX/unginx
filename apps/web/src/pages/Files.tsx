import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Tag, Dropdown, Drawer, Form, Input,
  Select, Switch, Typography, Modal, message, Collapse, Alert, List,
  Spin,
} from 'antd'
import {
  PlusOutlined, FolderOutlined, MoreOutlined, EditOutlined, DeleteOutlined,
  NodeIndexOutlined, CheckCircleOutlined, StopOutlined, FolderOpenOutlined,
} from '@ant-design/icons'
import type { FileRoute, Group, CreateFileRouteInput, SSEEvent } from '@unginx/shared'
import { PageHeader } from '../components/PageHeader.js'
import { HealthDot } from '../components/HealthDot.js'
import { apiFetch } from '../api/client.js'
import {
  useAllFileRoutes,
  useCreateFileRoute,
  useDeleteFileRoute,
  useToggleFileRoute,
  useMoveFileRoute,
} from '../api/file-routes.js'
import { useGroups, useCreateGroup, useDeleteGroup } from '../api/groups.js'
import { useHealthStatus } from '../api/dashboard.js'
import { useSSE } from '../sse.js'

const { Text } = Typography
const { Option } = Select

type HealthStatus = 'up' | 'down' | 'unknown' | 'missing'

// ─── BrowseModal ──────────────────────────────────────────────────────────────

interface BrowseModalProps {
  open: boolean
  onClose: () => void
  onSelect: (path: string) => void
}

function BrowseModal({ open, onClose, onSelect }: BrowseModalProps) {
  const [currentPath, setCurrentPath] = useState('/data/sites')
  const [entries, setEntries] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = async (path: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch<{ path: string; entries: Array<{ name: string; isDirectory: boolean }> }>(
        `/files/browse?path=${encodeURIComponent(path)}`
      )
      setEntries((data.entries ?? []).filter((e) => e.isDirectory).map((e) => e.name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory')
      setEntries([])
    } finally {
      setLoading(false)
    }
  }

  const handleOpen = () => {
    setCurrentPath('/data/sites')
    fetchEntries('/data/sites')
  }

  const handleNavigate = (entry: string) => {
    const next = currentPath.endsWith('/') ? `${currentPath}${entry}` : `${currentPath}/${entry}`
    setCurrentPath(next)
    fetchEntries(next)
  }

  const handleUp = () => {
    const parts = currentPath.replace(/\/$/, '').split('/')
    parts.pop()
    const parent = parts.join('/') || '/'
    setCurrentPath(parent)
    fetchEntries(parent)
  }

  return (
    <Modal
      title="Browse Folders"
      open={open}
      onCancel={onClose}
      afterOpenChange={(visible) => { if (visible) handleOpen() }}
      footer={
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={() => { onSelect(currentPath); onClose() }}
          >
            Select "{currentPath}"
          </Button>
        </Space>
      }
      styles={{
        content: { background: 'var(--elevated)', border: '1px solid var(--border-subtle)' },
        header: { background: 'var(--elevated)', borderBottom: '1px solid var(--border-subtle)' },
        body: { background: 'var(--elevated)' },
        footer: { background: 'var(--elevated)', borderTop: '1px solid var(--border-subtle)' },
        mask: { background: 'rgba(0,0,0,0.55)' },
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {/* Current path breadcrumb */}
        <Space style={{ fontFamily: 'monospace', fontSize: 13 }}>
          <Text type="secondary">Current:</Text>
          <Text strong style={{ color: 'var(--accent-primary)' }}>{currentPath}</Text>
        </Space>

        {/* Navigation */}
        <Space>
          <Button size="small" onClick={handleUp} disabled={currentPath === '/'}>
            Up
          </Button>
          <Button size="small" onClick={() => fetchEntries(currentPath)}>
            Refresh
          </Button>
        </Space>

        {/* Error */}
        {error && (
          <Alert type="error" message={error} showIcon style={{ marginBottom: 0 }} />
        )}

        {/* Entries list */}
        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : entries.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Text type="secondary">No subdirectories found</Text>
            </div>
          ) : (
            <List
              size="small"
              dataSource={entries}
              renderItem={(entry) => (
                <List.Item
                  style={{ cursor: 'pointer', padding: '8px 16px' }}
                  onClick={() => handleNavigate(entry)}
                >
                  <Space>
                    <FolderOutlined style={{ color: 'var(--accent-primary)' }} />
                    <Text style={{ fontFamily: 'monospace' }}>{entry}</Text>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </div>
      </Space>
    </Modal>
  )
}

// ─── FileRouteDrawer ──────────────────────────────────────────────────────────

interface FileRouteDrawerProps {
  open: boolean
  onClose: () => void
  editingRoute: FileRoute | null
  groups: Group[]
  onCreate: (values: CreateFileRouteInput) => Promise<void>
  onUpdate: (id: string, values: Partial<CreateFileRouteInput>) => Promise<void>
  isCreating: boolean
}

function FileRouteDrawer({
  open,
  onClose,
  editingRoute,
  groups,
  onCreate,
  onUpdate,
  isCreating,
}: FileRouteDrawerProps) {
  const [form] = Form.useForm()
  const [spaMode, setSpaMode] = useState(false)
  const [browseOpen, setBrowseOpen] = useState(false)

  const handleOpen = () => {
    if (editingRoute) {
      form.setFieldsValue({
        name: editingRoute.name,
        group_id: editingRoute.group_id,
        path: editingRoute.path,
        folder_path: editingRoute.folder_path,
        index_files: editingRoute.index_files,
        dir_listing: editingRoute.dir_listing,
        try_files: editingRoute.try_files,
        spa_mode: editingRoute.spa_mode,
        enabled: editingRoute.enabled,
        description: editingRoute.description,
        client_max_body_size_mb: editingRoute.advanced_json?.client_max_body_size_mb,
        proxy_read_timeout_s: editingRoute.advanced_json?.proxy_read_timeout_s,
        proxy_connect_timeout_s: editingRoute.advanced_json?.proxy_connect_timeout_s,
        rate_limit_req_per_sec: editingRoute.advanced_json?.rate_limit_req_per_sec,
      })
      setSpaMode(editingRoute.spa_mode)
    } else {
      form.resetFields()
      form.setFieldsValue({
        index_files: 'index.html',
        dir_listing: false,
        spa_mode: false,
        enabled: true,
      })
      setSpaMode(false)
    }
  }

  const handleSpaChange = (checked: boolean) => {
    setSpaMode(checked)
    if (checked) {
      form.setFieldValue('try_files', '/index.html')
    }
  }

  const handleFinish = async (values: Record<string, unknown>) => {
    const advanced: Record<string, unknown> = {}
    if (values.client_max_body_size_mb != null) advanced.client_max_body_size_mb = values.client_max_body_size_mb
    if (values.proxy_read_timeout_s != null) advanced.proxy_read_timeout_s = values.proxy_read_timeout_s
    if (values.proxy_connect_timeout_s != null) advanced.proxy_connect_timeout_s = values.proxy_connect_timeout_s
    if (values.rate_limit_req_per_sec != null) advanced.rate_limit_req_per_sec = values.rate_limit_req_per_sec

    const payload: CreateFileRouteInput = {
      name: values.name as string,
      path: (values.path as string).startsWith('/') ? (values.path as string) : `/${values.path as string}`,
      folder_path: values.folder_path as string,
      index_files: (values.index_files as string | undefined) ?? 'index.html',
      dir_listing: (values.dir_listing as boolean | undefined) ?? false,
      try_files: (values.spa_mode as boolean) ? '/index.html' : ((values.try_files as string | null | undefined) ?? null),
      spa_mode: (values.spa_mode as boolean | undefined) ?? false,
      enabled: (values.enabled as boolean | undefined) ?? true,
      group_id: (values.group_id as string | undefined) ?? null,
      description: (values.description as string | undefined) ?? null,
      advanced_json: Object.keys(advanced).length > 0 ? advanced as CreateFileRouteInput['advanced_json'] : undefined,
    }

    if (editingRoute) {
      await onUpdate(editingRoute.id, payload)
    } else {
      await onCreate(payload)
    }
  }

  return (
    <>
      <Drawer
        title={editingRoute ? 'Edit File Route' : 'New File Route'}
        placement="right"
        width={520}
        open={open}
        onClose={onClose}
        afterOpenChange={(visible) => { if (visible) handleOpen() }}
        styles={{
          body: { background: 'var(--surface)' },
          header: { background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' },
        }}
        extra={
          <Button type="primary" onClick={() => form.submit()} loading={isCreating}>
            Save
          </Button>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleFinish}
          initialValues={{ index_files: 'index.html', dir_listing: false, spa_mode: false, enabled: true }}
        >
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="my-site" />
          </Form.Item>

          <Form.Item name="group_id" label="Group">
            <Select placeholder="Ungrouped" allowClear>
              {groups.map((g) => (
                <Option key={g.id} value={g.id}>{g.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="path"
            label="URL Path"
            rules={[
              { required: true, message: 'Path is required' },
              { pattern: /^\//, message: 'Path must start with /' },
            ]}
          >
            <Input placeholder="/static" />
          </Form.Item>

          <Form.Item
            name="folder_path"
            label="Folder Path"
            rules={[
              { required: true, message: 'Folder path is required' },
              { pattern: /^\//, message: 'Folder path must be absolute' },
            ]}
          >
            <Input
              placeholder="/data/sites/my-site"
              addonAfter={
                <Button
                  type="link"
                  size="small"
                  style={{ padding: 0, height: 'auto' }}
                  onClick={() => setBrowseOpen(true)}
                >
                  Browse
                </Button>
              }
            />
          </Form.Item>

          <Form.Item name="index_files" label="Index Files">
            <Input placeholder="index.html" />
          </Form.Item>

          <Form.Item name="dir_listing" label="Directory Listing" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="spa_mode" label="SPA Mode" valuePropName="checked">
            <Switch onChange={handleSpaChange} />
          </Form.Item>

          {!spaMode && (
            <Form.Item name="try_files" label="Try Files">
              <Input placeholder="/index.html (optional)" />
            </Form.Item>
          )}

          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional notes" />
          </Form.Item>

          <Collapse ghost>
            <Collapse.Panel header="Advanced" key="advanced">
              <Form.Item name="client_max_body_size_mb" label="Max Request Body (MB)">
                <Input type="number" placeholder="10" />
              </Form.Item>
              <Form.Item name="proxy_read_timeout_s" label="Read Timeout (s)">
                <Input type="number" placeholder="60" />
              </Form.Item>
              <Form.Item name="proxy_connect_timeout_s" label="Connect Timeout (s)">
                <Input type="number" placeholder="5" />
              </Form.Item>
              <Form.Item name="rate_limit_req_per_sec" label="Rate Limit (req/s, 0=off)">
                <Input type="number" placeholder="0" />
              </Form.Item>
            </Collapse.Panel>
          </Collapse>
        </Form>
      </Drawer>

      <BrowseModal
        open={browseOpen}
        onClose={() => setBrowseOpen(false)}
        onSelect={(path) => form.setFieldValue('folder_path', path)}
      />
    </>
  )
}

// ─── Files Page ───────────────────────────────────────────────────────────────

export default function Files() {
  const { data: fileRoutes = [], isLoading } = useAllFileRoutes()
  const { data: groups = [] } = useGroups('file')
  const { data: healthData } = useHealthStatus()
  const createFileRoute = useCreateFileRoute()
  const deleteFileRoute = useDeleteFileRoute()
  const toggleFileRoute = useToggleFileRoute()
  const moveFileRoute = useMoveFileRoute()
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<FileRoute | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [movingRoute, setMovingRoute] = useState<FileRoute | null>(null)
  const [moveTarget, setMoveTarget] = useState<string | null>(null)
  const [healthMap, setHealthMap] = useState<Map<string, HealthStatus>>(new Map())
  const [groupForm] = Form.useForm()

  // Seed health from initial fetch
  const initialHealth = new Map<string, HealthStatus>()
  healthData?.routes.forEach((r) => initialHealth.set(r.id, r.status as HealthStatus))
  healthData?.fileRoutes.forEach((r) => initialHealth.set(r.id, r.status as HealthStatus))

  // Update via SSE
  useSSE(useCallback((event: SSEEvent) => {
    if (event.event === 'health') {
      setHealthMap((prev) => {
        const next = new Map(prev)
        next.set(event.data.id, event.data.status as HealthStatus)
        return next
      })
    }
  }, []))

  const getHealth = (id: string): HealthStatus =>
    healthMap.get(id) ?? initialHealth.get(id) ?? 'unknown'

  const openCreate = () => {
    setEditingRoute(null)
    setDrawerOpen(true)
  }

  const openEdit = (route: FileRoute) => {
    setEditingRoute(route)
    setDrawerOpen(true)
  }

  const handleUpdate = async (id: string, payload: Partial<CreateFileRouteInput>) => {
    try {
      await apiFetch(`/file-routes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      await queryClient.invalidateQueries({ queryKey: ['file-routes'] })
      message.success('File route updated')
      setDrawerOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update file route')
    }
  }

  const handleCreateWithFolderWarning = async (payload: CreateFileRouteInput) => {
    try {
      const created = await createFileRoute.mutateAsync(payload)
      message.success('File route created')
      setDrawerOpen(false)
      // Non-blocking folder-missing warning: check SSE health after a brief delay
      // to give the server time to emit the first health event for this route.
      setTimeout(() => {
        setHealthMap((prev) => {
          const status = prev.get(created.id)
          if (status === 'missing') {
            message.warning("Folder not found — you can still save; mount it before the route is needed.")
          }
          return prev
        })
      }, 2000)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create file route')
    }
  }

  // Group file routes by group_id
  const routesByGroup = new Map<string | null, FileRoute[]>()
  routesByGroup.set(null, [])
  groups.forEach((g) => routesByGroup.set(g.id, []))
  fileRoutes.forEach((r) => {
    const key = routesByGroup.has(r.group_id) ? r.group_id : null
    const bucket = routesByGroup.get(key) ?? []
    bucket.push(r)
    routesByGroup.set(key, bucket)
  })

  const routeColumns = () => [
    {
      title: '',
      key: 'health',
      width: 24,
      render: (_: unknown, r: FileRoute) => <HealthDot status={getHealth(r.id)} disabled={!r.enabled} />,
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      render: (path: string) => (
        <Text strong style={{ color: 'var(--accent-primary)', fontFamily: 'monospace' }}>{path}</Text>
      ),
    },
    {
      title: 'Folder',
      dataIndex: 'folder_path',
      key: 'folder_path',
      render: (folder: string, r: FileRoute) => (
        <Space size={4}>
          <Text style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 13 }}>{folder}</Text>
          {getHealth(r.id) === 'missing' && (
            <Tag color="warning">missing</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Flags',
      key: 'flags',
      render: (_: unknown, r: FileRoute) => (
        <Space size={4}>
          {r.spa_mode && <Tag color="purple">SPA</Tag>}
          {r.dir_listing && <Tag color="geekblue">dir listing</Tag>}
        </Space>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, r: FileRoute) => (
        <Tag color={r.enabled ? 'blue' : 'default'}>{r.enabled ? 'enabled' : 'disabled'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_: unknown, r: FileRoute) => (
        <Dropdown
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => openEdit(r) },
              {
                key: 'toggle',
                icon: r.enabled ? <StopOutlined /> : <CheckCircleOutlined />,
                label: r.enabled ? 'Disable' : 'Enable',
                onClick: () => toggleFileRoute.mutate({ id: r.id, enabled: !r.enabled }),
              },
              {
                key: 'move',
                icon: <FolderOpenOutlined />,
                label: 'Move to group…',
                onClick: () => {
                  setMovingRoute(r)
                  setMoveTarget(r.group_id)
                  setMoveModalOpen(true)
                },
              },
              { type: 'divider' as const },
              {
                key: 'delete',
                icon: <DeleteOutlined />,
                label: 'Delete',
                danger: true,
                onClick: () =>
                  Modal.confirm({
                    title: `Delete "${r.name}"?`,
                    content: 'This will remove the nginx config for this file route.',
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: () => deleteFileRoute.mutate(r.id),
                  }),
              },
            ],
          }}
          trigger={['click']}
        >
          <Button type="text" icon={<MoreOutlined />} size="small" />
        </Dropdown>
      ),
    },
  ]

  const ungrouped = routesByGroup.get(null) ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <PageHeader
        title="Files"
        subtitle="Manage static file serving routes"
        extra={
          <Space>
            <Button
              icon={<FolderOutlined />}
              onClick={() => { groupForm.resetFields(); setGroupModalOpen(true) }}
            >
              New Group
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              New File Route
            </Button>
          </Space>
        }
      />

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <Alert
          type="info"
          message={
            <Space>
              <Text>{selectedIds.length} selected</Text>
              <Button
                size="small"
                onClick={() => {
                  selectedIds.forEach((id) => toggleFileRoute.mutate({ id, enabled: true }))
                }}
              >
                Enable
              </Button>
              <Button
                size="small"
                onClick={() => {
                  selectedIds.forEach((id) => toggleFileRoute.mutate({ id, enabled: false }))
                }}
              >
                Disable
              </Button>
              <Button
                size="small"
                danger
                onClick={() =>
                  Modal.confirm({
                    title: `Delete ${selectedIds.length} file routes?`,
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: () => {
                      selectedIds.forEach((id) => deleteFileRoute.mutate(id))
                      setSelectedIds([])
                    },
                  })
                }
              >
                Delete
              </Button>
              <Button size="small" type="text" onClick={() => setSelectedIds([])}>
                Clear
              </Button>
            </Space>
          }
          showIcon
        />
      )}

      {/* Groups */}
      {groups.map((group) => {
        const groupRoutes = routesByGroup.get(group.id) ?? []
        return (
          <Card
            key={group.id}
            style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}
            styles={{ body: { padding: 0 } }}
            title={
              <Space>
                <FolderOutlined style={{ color: 'var(--accent-primary)' }} />
                <Text strong style={{ color: 'var(--text-primary)' }}>{group.name}</Text>
                <Tag>{groupRoutes.length} routes</Tag>
              </Space>
            }
            extra={
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'delete',
                      icon: <DeleteOutlined />,
                      label: 'Delete group',
                      danger: true,
                      onClick: () =>
                        Modal.confirm({
                          title: `Delete group "${group.name}"?`,
                          content: 'File routes in this group will become ungrouped.',
                          okText: 'Delete',
                          okButtonProps: { danger: true },
                          onOk: () => deleteGroup.mutate({ id: group.id, mode: 'move' }),
                        }),
                    },
                  ],
                }}
                trigger={['click']}
              >
                <Button type="text" icon={<MoreOutlined />} size="small" />
              </Dropdown>
            }
          >
            <Table
              dataSource={groupRoutes}
              columns={routeColumns()}
              rowKey="id"
              size="small"
              pagination={false}
              loading={isLoading}
              rowSelection={{
                selectedRowKeys: selectedIds,
                onChange: (keys) => setSelectedIds(keys as string[]),
              }}
              locale={{ emptyText: 'No file routes in this group' }}
            />
          </Card>
        )
      })}

      {/* Ungrouped */}
      <Card
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)', borderRadius: 12 }}
        styles={{ body: { padding: 0 } }}
        title={
          <Space>
            <NodeIndexOutlined style={{ color: 'var(--text-muted)' }} />
            <Text style={{ color: 'var(--text-secondary)' }}>Ungrouped</Text>
            <Tag>{ungrouped.length} routes</Tag>
          </Space>
        }
      >
        <Table
          dataSource={ungrouped}
          columns={routeColumns()}
          rowKey="id"
          size="small"
          pagination={false}
          loading={isLoading}
          rowSelection={{
            selectedRowKeys: selectedIds,
            onChange: (keys) => setSelectedIds(keys as string[]),
          }}
          locale={{ emptyText: 'No ungrouped file routes' }}
        />
      </Card>

      {/* File Route Drawer */}
      <FileRouteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingRoute={editingRoute}
        groups={groups}
        onCreate={handleCreateWithFolderWarning}
        onUpdate={handleUpdate}
        isCreating={createFileRoute.isPending}
      />

      {/* New Group Modal */}
      <Modal
        title="New Group"
        open={groupModalOpen}
        onCancel={() => setGroupModalOpen(false)}
        onOk={() => groupForm.submit()}
        okText="Create"
        confirmLoading={createGroup.isPending}
        styles={{
          content: { background: 'var(--elevated)', border: '1px solid var(--border-subtle)' },
          header: { background: 'var(--elevated)', borderBottom: '1px solid var(--border-subtle)' },
          body: { background: 'var(--elevated)' },
          footer: { background: 'var(--elevated)', borderTop: '1px solid var(--border-subtle)' },
          mask: { background: 'rgba(0,0,0,0.55)' },
        }}
      >
        <Form
          form={groupForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await createGroup.mutateAsync({ kind: 'file', name: values.name, description: values.description ?? null })
              message.success('Group created')
              setGroupModalOpen(false)
            } catch (err) {
              message.error(err instanceof Error ? err.message : 'Failed to create group')
            }
          }}
        >
          <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Group name is required' }]}>
            <Input placeholder="marketing-sites" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Move to Group Modal */}
      <Modal
        title={`Move "${movingRoute?.name}" to group`}
        open={moveModalOpen}
        onCancel={() => setMoveModalOpen(false)}
        onOk={async () => {
          if (!movingRoute) return
          try {
            await moveFileRoute.mutateAsync({ id: movingRoute.id, group_id: moveTarget })
            message.success('File route moved')
            setMoveModalOpen(false)
          } catch (err) {
            message.error(err instanceof Error ? err.message : 'Failed to move file route')
          }
        }}
        confirmLoading={moveFileRoute.isPending}
        styles={{
          content: { background: 'var(--elevated)', border: '1px solid var(--border-subtle)' },
          header: { background: 'var(--elevated)', borderBottom: '1px solid var(--border-subtle)' },
          body: { background: 'var(--elevated)' },
          footer: { background: 'var(--elevated)', borderTop: '1px solid var(--border-subtle)' },
          mask: { background: 'rgba(0,0,0,0.55)' },
        }}
      >
        <Select
          value={moveTarget}
          onChange={setMoveTarget}
          style={{ width: '100%' }}
          placeholder="Select group (empty = Ungrouped)"
          allowClear
        >
          {groups.map((g) => (
            <Option key={g.id} value={g.id}>{g.name}</Option>
          ))}
        </Select>
      </Modal>
    </div>
  )
}
