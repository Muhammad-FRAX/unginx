import React, { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, Spin } from 'antd'
import { getAntdConfig } from './theme/antd.js'
import { applyTheme, THEME_STORAGE_KEY } from './theme/tokens.js'
import { useMe } from './api/auth.js'
import { Shell } from './components/Shell.js'
import Login from './pages/Login.js'
import ForceChangePassword from './pages/ForceChangePassword.js'
import Dashboard from './pages/Dashboard.js'
import RoutesPage from './pages/Routes.js'
import Files from './pages/Files.js'
import History from './pages/History.js'
import Settings from './pages/Settings.js'
import Logs from './pages/Logs.js'

interface AppProps {
  initialTheme: 'light' | 'dark'
}

function AuthGuard({
  children,
  theme,
  onToggle,
}: {
  children?: React.ReactNode
  theme: 'light' | 'dark'
  onToggle: () => void
}) {
  const { data: user, isLoading, error } = useMe()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--canvas)',
        }}
      >
        <Spin size="large" />
      </div>
    )
  }

  if (error || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.must_change_password) {
    return <Navigate to="/force-change-password" replace />
  }

  return (
    <Shell theme={theme} onToggle={onToggle} username={user.username} />
  )
}

export default function App({ initialTheme }: AppProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(initialTheme)

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      localStorage.setItem(THEME_STORAGE_KEY, next)
      return next
    })
  }, [])

  return (
    <ConfigProvider theme={getAntdConfig(mode)}>
      <BrowserRouter basename="/__unginx">
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/force-change-password" element={<ForceChangePassword />} />

          {/* Protected routes — Shell wraps them */}
          <Route
            element={<AuthGuard theme={mode} onToggle={toggleTheme} />}
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/routes" element={<RoutesPage />} />
            <Route path="/files" element={<Files />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/logs" element={<Logs />} />
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  )
}
