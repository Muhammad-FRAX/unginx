import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.js'
import { applyTheme, getSystemPreference, THEME_STORAGE_KEY } from './theme/tokens.js'
import './index.css'

const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as 'light' | 'dark' | null
const initialTheme = storedTheme ?? getSystemPreference()
applyTheme(initialTheme)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App initialTheme={initialTheme} />
    </QueryClientProvider>
  </React.StrictMode>
)
