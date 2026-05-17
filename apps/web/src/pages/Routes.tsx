import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  Card, Table, Button, Space, Tag, Dropdown, Drawer, Form, Input,
  Select, Switch, Typography, Modal, message, InputNumber,
  Collapse, Alert,
} from 'antd'
import {
  PlusOutlined, FolderOutlined, MoreOutlined, EditOutlined, DeleteOutlined,
  CopyOutlined, NodeIndexOutlined, CheckCircleOutlined, StopOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons'
import type { Route, Group, CreateRouteInput, SSEEvent } from '@unginx/shared'
import { PageHeader } from '../components/PageHeader.js'
import { HealthDot } from '../components/HealthDot.js'
import { apiFetch } from '../api/client.js'
import {
  useAllRoutes,
  useCreateRoute,
  useDeleteRoute,
  useToggleRoute,
  useDuplicateRoute,
  useMoveRoute,
  useBulkRoutes,
} from '../api/routes.js'
import { useGroups, useCreateGroup, useDeleteGroup } from '../api/groups.js'
import { useHealthStatus } from '../api/dashboard.js'
import { useSSE } from '../sse.js'

const { Text } = Typography
const { Option } = Select

type HealthStatus = 'up' | 'down' | 'unknown' | 'missing'

// ─── RouteDrawer ─────────────────────────────────────────────────────────────

interface RouteDrawerProps {
  open: boolean
  onClose: () => void
  editingRoute: Route | null
  groups: Group[]
  onCreate: (values: CreateRouteInput) => Promise<void>
  onUpdate: (id: string, values: Partial<CreateRouteInput>) => Promise<void>
  isCreating: boolean
}

function RouteDrawer({
  open,
  onClose,
  editingRoute,
  groups,
  onCreate,
  onUpdate,
  isCreating,
}: RouteDrawerProps) {
  const [form] = Form.useForm()

  const handleOpen = () => {
    if (editingRoute) {
      form.setFieldsValue({
        name: editingRoute.name,
        group_id: editingRoute.group_id,
        path: editingRoute.path,
        upstream_host: editingRoute.upstream_host,
        upstream_port: editingRoute.upstream_port,
        upstream_scheme: editingRoute.upstream_scheme,
        strip_prefix: editingRoute.strip_prefix,
        websocket: editingRoute.websocket,
        enabled: editingRoute.enabled,
        description: editingRoute.description,
        client_max_body_size_mb: editingRoute.advanced_json?.client_max_body_size_mb,
        proxy_read_timeout_s: editingRoute.advanced_json?.proxy_read_timeout_s,
        proxy_connect_timeout_s: editingRoute.advanced_json?.proxy_connect_timeout_s,
        rate_limit_req_per_sec: editingRoute.advanced_json?.rate_limit_req_per_sec,
      })
    } else {
      form.resetFields()
      form.setFieldsValue({
        upstream_scheme: 'http',
        strip_prefix: true,
        websocket: false,
        enabled: true,
      })
    }
  }

  const handleFinish = async (values: Record<string, unknown>) => {
    const advanced: Record<string, unknown> = {}
    if (values.client_max_body_size_mb != null) advanced.client_max_body_size_mb = values.client_max_body_size_mb
    if (values.proxy_read_timeout_s != null) advanced.proxy_read_timeout_s = values.proxy_read_timeout_s
    if (values.proxy_connect_timeout_s != null) advanced.proxy_connect_timeout_s = values.proxy_connect_timeout_s
    if (values.rate_limit_req_per_sec != null) advanced.rate_limit_req_per_sec = values.rate_limit_req_per_sec

    const payload: CreateRouteInput = {
      name: values.name as string,
      path: (values.path as string).startsWith('/') ? (values.path as string) : `/${values.path as string}`,
      upstream_host: values.upstream_host as string,
      upstream_port: values.upstream_port as number,
      upstream_scheme: (values.upstream_scheme as 'http' | 'https') ?? 'http',
      strip_prefix: (values.strip_prefix as boolean) ?? true,
      websocket: (values.websocket as boolean) ?? false,
      enabled: (values.enabled as boolean) ?? true,
      group_id: (values.group_id as string | undefined) ?? null,
      description: (values.description as string | undefined) ?? null,
      advanced_json: Object.keys(advanced).length > 0 ? advanced as CreateRouteInput['advanced_json'] : undefined,
    }

    if (editingRoute) {
      await onUpdate(editingRoute.id, payload)
    } else {
      await onCreate(payload)
    }
  }

  return (
    <Drawer
      title={editingRoute ? 'Edit Route' : 'New Route'}
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
        initialValues={{ upstream_scheme: 'http', strip_prefix: true, websocket: false, enabled: true }}
      >
        <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
          <Input placeholder="my-service" />
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
          label="Path"
          rules={[
            { required: true, message: 'Path is required' },
            { pattern: /^\//, message: 'Path must start with /' },
          ]}
        >
          <Input placeholder="/api" />
        </Form.Item>

        <Form.Item name="upstream_host" label="Upstream Host" rules={[{ required: true, message: 'Upstream host is required' }]}>
          <Input placeholder="localhost or 10.0.0.5" />
        </Form.Item>

        <Form.Item name="upstream_port" label="Upstream Port" rules={[{ required: true, message: 'Upstream port is required' }]}>
          <InputNumber min={1} max={65535} placeholder="4000" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item name="upstream_scheme" label="Scheme">
          <Select>
            <Option value="http">http</Option>
            <Option value="https">https</Option>
          </Select>
        </Form.Item>

        <Form.Item name="strip_prefix" label="Strip Prefix" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="websocket" label="WebSocket Support" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="enabled" label="Enabled" valuePropName="checked">
          <Switch />
        </Form.Item>

        <Form.Item name="description" label="Description">
          <Input.TextArea rows={2} placeholder="Optional notes" />
        </Form.Item>

        <Collapse ghost>
          <Collapse.Panel header="Advanced" key="advanced">
            <Form.Item name="client_max_body_size_mb" label="Max Request Body (MB)">
              <InputNumber min={1} placeholder="10" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="proxy_read_timeout_s" label="Read Timeout (s)">
              <InputNumber min={1} placeholder="60" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="proxy_connect_timeout_s" label="Connect Timeout (s)">
              <InputNumber min={1} placeholder="5" style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="rate_limit_req_per_sec" label="Rate Limit (req/s, 0=off)">
              <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
            </Form.Item>
          </Collapse.Panel>
        </Collapse>
      </Form>
    </Drawer>
  )
}

// ─── Routes Page ──────────────────────────────────────────────────────────────

export default function Routes() {
  const { data: routes = [], isLoading } = useAllRoutes()
  const { data: groups = [] } = useGroups('proxy')
  const { data: healthData } = useHealthStatus()
  const createRoute = useCreateRoute()
  const deleteRoute = useDeleteRoute()
  const toggleRoute = useToggleRoute()
  const duplicateRoute = useDuplicateRoute()
  const moveRoute = useMoveRoute()
  const bulkAction = useBulkRoutes()
  const createGroup = useCreateGroup()
  const deleteGroup = useDeleteGroup()
  const queryClient = useQueryClient()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [groupModalOpen, setGroupModalOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [movingRoute, setMovingRoute] = useState<Route | null>(null)
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

  const openEdit = (route: Route) => {
    setEditingRoute(route)
    setDrawerOpen(true)
  }

  const handleCreate = async (payload: CreateRouteInput) => {
    try {
      await createRoute.mutateAsync(payload)
      message.success('Route created')
      setDrawerOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to create route')
    }
  }

  const handleUpdate = async (id: string, payload: Partial<CreateRouteInput>) => {
    try {
      await apiFetch(`/routes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      await queryClient.invalidateQueries({ queryKey: ['routes'] })
      message.success('Route updated')
      setDrawerOpen(false)
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Failed to update route')
    }
  }

  // Group routes by group_id
  const routesByGroup = new Map<string | null, Route[]>()
  routesByGroup.set(null, [])
  groups.forEach((g) => routesByGroup.set(g.id, []))
  routes.forEach((r) => {
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
      render: (_: unknown, r: Route) => <HealthDot status={getHealth(r.id)} disabled={!r.enabled} />,
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
      title: 'Upstream',
      key: 'upstream',
      render: (_: unknown, r: Route) => (
        <Text style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 13 }}>
          {r.upstream_scheme}://{r.upstream_host}:{r.upstream_port}
        </Text>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: unknown, r: Route) => (
        <Tag color={r.enabled ? 'blue' : 'default'}>{r.enabled ? 'enabled' : 'disabled'}</Tag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 48,
      render: (_: unknown, r: Route) => (
        <Dropdown
          menu={{
            items: [
              { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => openEdit(r) },
              {
                key: 'toggle',
                icon: r.enabled ? <StopOutlined /> : <CheckCircleOutlined />,
                label: r.enabled ? 'Disable' : 'Enable',
                onClick: () => toggleRoute.mutate({ id: r.id, enabled: !r.enabled }),
              },
              {
                key: 'duplicate',
                icon: <CopyOutlined />,
                label: 'Duplicate',
                onClick: () => duplicateRoute.mutate(r.id),
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
                    content: 'This will remove the nginx config for this route.',
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: () => deleteRoute.mutate(r.id),
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
        title="Routes"
        subtitle="Manage reverse proxy routes"
        extra={
          <Space>
            <Button
              icon={<FolderOutlined />}
              onClick={() => { groupForm.resetFields(); setGroupModalOpen(true) }}
            >
              New Group
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              New Route
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
                onClick={() => bulkAction.mutate({ ids: selectedIds, action: 'enable' })}
              >
                Enable
              </Button>
              <Button
                size="small"
                onClick={() => bulkAction.mutate({ ids: selectedIds, action: 'disable' })}
              >
                Disable
              </Button>
              <Button
                size="small"
                danger
                onClick={() =>
                  Modal.confirm({
                    title: `Delete ${selectedIds.length} routes?`,
                    okText: 'Delete',
                    okButtonProps: { danger: true },
                    onOk: () => {
                      bulkAction.mutate({ ids: selectedIds, action: 'delete' })
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
                          content: 'Routes in this group will become ungrouped.',
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
              locale={{ emptyText: 'No routes in this group' }}
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
          locale={{ emptyText: 'No ungrouped routes' }}
        />
      </Card>

      {/* Route Drawer */}
      <RouteDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        editingRoute={editingRoute}
        groups={groups}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        isCreating={createRoute.isPending}
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
              await createGroup.mutateAsync({ kind: 'proxy', name: values.name, description: values.description ?? null })
              message.success('Group created')
              setGroupModalOpen(false)
            } catch (err) {
              message.error(err instanceof Error ? err.message : 'Failed to create group')
            }
          }}
        >
          <Form.Item name="name" label="Group Name" rules={[{ required: true, message: 'Group name is required' }]}>
            <Input placeholder="finance" />
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
            await moveRoute.mutateAsync({ id: movingRoute.id, group_id: moveTarget })
            message.success('Route moved')
            setMoveModalOpen(false)
          } catch (err) {
            message.error(err instanceof Error ? err.message : 'Failed to move route')
          }
        }}
        confirmLoading={moveRoute.isPending}
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
