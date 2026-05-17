import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useLogin } from '../api/auth.js'

const { Title, Text } = Typography

export default function Login() {
  const navigate = useNavigate()
  const login = useLogin()
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (values: { username: string; password: string }) => {
    setError(null)
    sessionStorage.setItem('unginx_login_pw', values.password)
    try {
      const result = await login.mutateAsync(values)
      if (result.mustChangePassword) {
        navigate('/force-change-password')
      } else {
        sessionStorage.removeItem('unginx_login_pw')
        navigate('/dashboard')
      }
    } catch (err) {
      sessionStorage.removeItem('unginx_login_pw')
      setError(err instanceof Error ? err.message : 'Login failed')
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
        boxShadow: '0 4px 6px -1px rgba(11, 18, 32, 0.12)',
        borderRadius: 12,
      }}>
        {/* Logo block */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img src="/unginx-logo.png" alt="unginx" style={{ height: 64, marginBottom: 16 }} />
          <Title level={3} style={{ margin: 0, color: 'var(--text-primary)' }}>unginx</Title>
          <Text style={{ color: 'var(--text-muted)', fontSize: 14 }}>nginx, made friendly.</Text>
        </div>

        {/* Error alert */}
        {error && (
          <Alert
            message="Login Failed"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError(null)}
            style={{ marginBottom: 24 }}
          />
        )}

        {/* Form */}
        <Form size="large" onFinish={handleSubmit} layout="vertical">
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please enter your username' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder="Username"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please enter your password' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-muted)' }} />}
              placeholder="Password"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={login.isPending}
              block
              size="large"
              style={{ fontWeight: 600 }}
            >
              {login.isPending ? 'Signing in…' : 'Sign In'}
            </Button>
          </Form.Item>
        </Form>

        {/* Footer */}
        <div style={{
          textAlign: 'center',
          marginTop: 24,
          paddingTop: 24,
          borderTop: '1px solid var(--border-subtle)',
        }}>
          <Text style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            unginx © {new Date().getFullYear()}
          </Text>
        </div>
      </Card>
    </div>
  )
}
