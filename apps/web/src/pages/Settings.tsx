import { useState } from 'react'
import {
  Card, Form, Input, Button, Space, Typography, Alert, Divider,
  Descriptions, Modal, Select, Tag, message, Spin,
} from 'antd'
import {
  UserOutlined, LockOutlined, NodeIndexOutlined, SettingOutlined,
  WarningOutlined, CloudDownloadOutlined, CloudUploadOutlined,
  DeleteOutlined, ReloadOutlined, CheckCircleOutlined,
} from '@ant-design/icons'
import { PageHeader } from '../components/PageHeader.js'
import { useSettings, useUpdateAdminPath, useUpdateAccount, useNginxTest, useNginxReload, useExportData, useImportData, useResetData } from '../api/settings.js'
import { useQueryClient } from '@tanstack/react-query'

const { Title, Text } = Typography
const { Option } = Select

export default function Settings() {
  const { data: settings, isLoading } = useSettings()
  const updateAdminPath = useUpdateAdminPath()
  const updateAccount = useUpdateAccount()
  const nginxTest = useNginxTest()
  const nginxReload = useNginxReload()
  const exportData = useExportData()
  const importData = useImportData()
  const resetData = useResetData()
  const qc = useQueryClient()

  const [testOutput, setTestOutput] = useState<string | null>(null)
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge')
  const [adminPathForm] = Form.useForm()
  const [accountForm] = Form.useForm()

  if (isLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>
  }

  const cardStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 12,
  }
  const headerStyle = { borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }

  const handleExport = async () => {
    try {
      const data = await exportData.mutateAsync(undefined)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `unginx-export-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      message.error('Export failed')
    }
  }

  const handleImport = async () => {
    try {
      const data = JSON.parse(importJson)
      await importData.mutateAsync({ data, mode: importMode })
      message.success('Import successful')
      setImportJson('')
      qc.invalidateQueries({ queryKey: ['routes'] })
      qc.invalidateQueries({ queryKey: ['file-routes'] })
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Import failed')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader title="Settings" subtitle="Manage your unginx configuration" />

      {/* Admin Account */}
      <Card
        title={<Space><UserOutlined style={{ color: 'var(--accent-primary)' }} /><span>Admin Account</span></Space>}
        style={cardStyle}
        styles={{ header: headerStyle }}
      >
        <Form
          form={accountForm}
          layout="vertical"
          onFinish={async (values) => {
            try {
              await updateAccount.mutateAsync({
                current_password: values.current_password,
                new_username: values.new_username || undefined,
                new_password: values.new_password || undefined,
              })
              message.success('Account updated')
              accountForm.resetFields()
            } catch (err) {
              message.error(err instanceof Error ? err.message : 'Update failed')
            }
          }}
        >
          <Form.Item
            name="current_password"
            label="Current Password"
            rules={[{ required: true, message: 'Current password required' }]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />} />
          </Form.Item>
          <Form.Item name="new_username" label="New Username (optional)">
            <Input prefix={<UserOutlined style={{ color: 'var(--text-muted)' }} />} placeholder="Leave blank to keep current" />
          </Form.Item>
          <Form.Item name="new_password" label="New Password (optional)">
            <Input.Password prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />} placeholder="Leave blank to keep current" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={updateAccount.isPending}>
            Update Account
          </Button>
        </Form>
      </Card>

      {/* Admin Path */}
      <Card
        title={<Space><NodeIndexOutlined style={{ color: 'var(--accent-primary)' }} /><span>Admin Path</span></Space>}
        style={cardStyle}
        styles={{ header: headerStyle }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Current</Text>
            <Text code style={{ display: 'block', marginTop: 4, fontSize: 15 }}>{settings?.adminPath}</Text>
          </div>
          <Alert
            type="warning"
            message="Changing the admin path will regenerate the nginx config. The page will redirect to the new path."
            showIcon
            style={{ marginTop: 8 }}
          />
          <Form
            form={adminPathForm}
            layout="inline"
            onFinish={async (values) => {
              try {
                const result = await updateAdminPath.mutateAsync(values.newPath)
                message.success(`Admin path changed to ${result.newPath}`)
                window.location.href = `${result.newPath}`
              } catch (err) {
                message.error(err instanceof Error ? err.message : 'Failed')
              }
            }}
          >
            <Form.Item name="newPath" rules={[{ required: true, pattern: /^\//, message: 'Must start with /' }]}>
              <Input placeholder="/__unginx" style={{ width: 200 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={updateAdminPath.isPending} danger>
              Change Path
            </Button>
          </Form>
        </Space>
      </Card>

      {/* Deployment Info */}
      <Card
        title={<Space><SettingOutlined style={{ color: 'var(--accent-primary)' }} /><span>Deployment</span></Space>}
        style={cardStyle}
        styles={{ header: headerStyle }}
      >
        <Descriptions bordered size="small" column={2}>
          <Descriptions.Item label="Mode">
            <Tag color={settings?.deployment.mode === 'container' ? 'blue' : 'green'}>
              {settings?.deployment.mode}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Hostname">{settings?.deployment.hostname}</Descriptions.Item>
          <Descriptions.Item label="Platform">{settings?.deployment.platform}</Descriptions.Item>
          <Descriptions.Item label="App Version">{settings?.deployment.appVersion}</Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Nginx */}
      <Card
        title={<Space><SettingOutlined style={{ color: 'var(--accent-primary)' }} /><span>Nginx</span></Space>}
        style={cardStyle}
        styles={{ header: headerStyle }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text><strong>Version:</strong> {settings?.nginxVersion}</Text>
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              loading={nginxReload.isPending}
              onClick={async () => {
                try {
                  await nginxReload.mutateAsync()
                  message.success('Nginx reloaded')
                } catch (err) {
                  message.error(err instanceof Error ? err.message : 'Reload failed')
                }
              }}
            >
              Reload Nginx
            </Button>
            <Button
              icon={<CheckCircleOutlined />}
              loading={nginxTest.isPending}
              onClick={async () => {
                try {
                  const result = await nginxTest.mutateAsync()
                  setTestOutput(result.output || 'Config test passed')
                } catch (err) {
                  setTestOutput(err instanceof Error ? err.message : 'Test failed')
                }
              }}
            >
              Test Config
            </Button>
          </Space>
          {testOutput && (
            <Alert
              message="Nginx Config Test"
              description={<pre style={{ fontSize: 12, whiteSpace: 'pre-wrap', margin: 0 }}>{testOutput}</pre>}
              type="info"
              showIcon
              closable
              onClose={() => setTestOutput(null)}
            />
          )}
        </Space>
      </Card>

      {/* Data */}
      <Card
        title={<Space><CloudDownloadOutlined style={{ color: 'var(--accent-primary)' }} /><span>Data</span></Space>}
        style={cardStyle}
        styles={{ header: headerStyle }}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Export</Title>
            <Button icon={<CloudDownloadOutlined />} onClick={handleExport} loading={exportData.isPending}>
              Export Routes &amp; Groups as JSON
            </Button>
          </div>

          <Divider style={{ borderColor: 'var(--border-subtle)', margin: '8px 0' }} />

          <div>
            <Title level={5} style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Import</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Select value={importMode} onChange={setImportMode} style={{ width: 200 }}>
                <Option value="merge">Merge (add/update)</Option>
                <Option value="replace">Replace (overwrite all)</Option>
              </Select>
              <Input.TextArea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                rows={4}
                placeholder="Paste JSON export here…"
              />
              <Button
                icon={<CloudUploadOutlined />}
                type="primary"
                onClick={handleImport}
                disabled={!importJson}
                loading={importData.isPending}
              >
                Import
              </Button>
            </Space>
          </div>

          <Divider style={{ borderColor: 'var(--border-subtle)', margin: '8px 0' }} />

          <div>
            <Title level={5} style={{ color: 'var(--status-danger)', marginBottom: 8 }}>Factory Reset</Title>
            <Alert
              type="error"
              message="This will delete ALL routes, file routes, and groups. This action cannot be undone."
              showIcon
              style={{ marginBottom: 12 }}
            />
            <Button danger icon={<DeleteOutlined />} onClick={() => setResetModalOpen(true)}>
              Reset to Factory
            </Button>
          </div>
        </Space>
      </Card>

      {/* Reset modal */}
      <Modal
        title={<Space><WarningOutlined style={{ color: 'var(--status-danger)' }} /><span style={{ color: 'var(--status-danger)' }}>Factory Reset</span></Space>}
        open={resetModalOpen}
        onCancel={() => { setResetModalOpen(false); setResetConfirm('') }}
        onOk={async () => {
          if (resetConfirm !== 'RESET') {
            message.error('Type RESET to confirm')
            return
          }
          try {
            await resetData.mutateAsync()
            message.success('Reset complete')
            setResetModalOpen(false)
            setResetConfirm('')
          } catch (err) {
            message.error(err instanceof Error ? err.message : 'Reset failed')
          }
        }}
        okText="Reset"
        okButtonProps={{ danger: true, disabled: resetConfirm !== 'RESET' }}
        styles={{
          content: { background: 'var(--elevated)', border: '1px solid var(--border-subtle)' },
          header: { background: 'var(--elevated)', borderBottom: '1px solid var(--border-subtle)' },
          body: { background: 'var(--elevated)' },
          footer: { background: 'var(--elevated)', borderTop: '1px solid var(--border-subtle)' },
          mask: { background: 'rgba(0,0,0,0.55)' },
        }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text style={{ color: 'var(--text-primary)' }}>
            Type <Text code>RESET</Text> to confirm factory reset:
          </Text>
          <Input
            value={resetConfirm}
            onChange={(e) => setResetConfirm(e.target.value)}
            placeholder="RESET"
            style={{ borderColor: resetConfirm !== 'RESET' && resetConfirm ? 'var(--status-danger)' : undefined }}
          />
        </Space>
      </Modal>
    </div>
  )
}
