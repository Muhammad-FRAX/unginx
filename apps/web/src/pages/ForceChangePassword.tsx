import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { LockOutlined } from '@ant-design/icons'
import { useChangePassword } from '../api/auth.js'
import { useQueryClient } from '@tanstack/react-query'

const { Title, Text } = Typography

export default function ForceChangePassword() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const changePassword = useChangePassword()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: { new_password: string; confirm_password: string }) => {
    if (values.new_password !== values.confirm_password) {
      setError('Passwords do not match')
      return
    }
    if (values.new_password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setError(null)
    try {
      const currentPassword = sessionStorage.getItem('unginx_login_pw') ?? 'unginx'
      await changePassword.mutateAsync({
        current_password: currentPassword,
        new_password: values.new_password,
      })
      sessionStorage.removeItem('unginx_login_pw')
      await qc.invalidateQueries({ queryKey: ['me'] })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--canvas)',
      padding: 20,
    }}>
      <Card style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--surface)',
        borderColor: 'var(--border-subtle)',
        borderRadius: 12,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/unginx-logo.png" alt="unginx" style={{ height: 56, marginBottom: 16 }} />
          <Title level={3} style={{ margin: 0, marginBottom: 8, color: 'var(--text-primary)' }}>
            Set a New Password
          </Title>
          <Text style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            You must change your password before continuing.
          </Text>
        </div>

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        <Form size="large" onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 8, message: 'Must be at least 8 characters' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder="New password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="Confirm Password"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Please confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Passwords do not match'))
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={changePassword.isPending}
              block
              size="large"
              style={{ fontWeight: 600 }}
            >
              {changePassword.isPending ? 'Saving…' : 'Set Password'}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
