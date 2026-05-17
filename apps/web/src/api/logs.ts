import { useMutation } from '@tanstack/react-query'
import { apiFetch } from './client.js'

export function useDownloadLogs() {
  return useMutation({
    mutationFn: async ({ type, lines }: { type: 'access' | 'error'; lines: number }) => {
      const res = await fetch(`/__unginx/api/logs/download?type=${type}&lines=${lines}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Download failed')
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${type}.log`
      a.click()
      URL.revokeObjectURL(url)
    },
  })
}

export function useTruncateLogs() {
  return useMutation({
    mutationFn: (type: 'access' | 'error') =>
      apiFetch<{ ok: boolean }>(`/logs/truncate?type=${type}`, { method: 'POST' }),
  })
}

export function useBrowseFiles() {
  return useMutation({
    mutationFn: (path: string) => apiFetch<{ entries: Array<{ name: string; isDir: boolean }> }>(`/files/browse?path=${encodeURIComponent(path)}`),
  })
}
