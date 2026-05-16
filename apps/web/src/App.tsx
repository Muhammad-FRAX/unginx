import React, { useState, useCallback } from 'react'
import { ConfigProvider } from 'antd'
import { getAntdConfig } from './theme/antd.js'
import { applyTheme, THEME_STORAGE_KEY } from './theme/tokens.js'

interface AppProps {
  initialTheme: 'light' | 'dark'
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
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <img
            src="/unginx-logo.png"
            alt="unginx"
            className="w-32 h-auto mx-auto mb-6"
          />
          <h1 className="text-4xl font-semibold text-text-primary mb-2">unginx</h1>
          <p className="text-text-muted text-base mb-8">nginx, made friendly.</p>
          <button
            onClick={toggleTheme}
            className="px-4 py-2 rounded border border-border-subtle text-text-secondary hover:bg-hover transition-colors text-sm"
          >
            Toggle theme ({mode})
          </button>
        </div>
      </div>
    </ConfigProvider>
  )
}
