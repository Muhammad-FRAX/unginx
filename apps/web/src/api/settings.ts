import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

export interface SettingsData {
  adminPath: string
  themeDefault: string
  nginxVersion: string
  schemaVersion: number
  deployment: {
    mode: 'container' | 'host'
    hostname: string
    platform: string
    appVersion: string
  }
  envVars: Record<string, string>
}

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => apiFetch<SettingsData>('/settings'),
  })
}

export function useUpdateAdminPath() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (newPath: string) =>
      apiFetch<{ ok: boolean; newPath: string }>('/settings/admin-path', {
        method: 'PATCH',
        body: JSON.stringify({ newPath }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings'] }),
  })
}

export function useUpdateAccount() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_username?: string; new_password?: string }) =>
      apiFetch<{ ok: boolean }>('/settings/account', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
  })
}

export function useNginxTest() {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean; output: string }>('/nginx/test', { method: 'POST' }),
  })
}

export function useNginxReload() {
  return useMutation({
    mutationFn: () => apiFetch<{ ok: boolean }>('/nginx/reload', { method: 'POST' }),
  })
}

export function useExportData() {
  return useMutation({
    mutationFn: () => apiFetch<unknown>('/data/export'),
  })
}

export function useImportData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ data, mode }: { data: unknown; mode: 'merge' | 'replace' }) =>
      apiFetch<{ ok: boolean }>(`/data/import?mode=${mode}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routes'] })
      qc.invalidateQueries({ queryKey: ['file-routes'] })
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

export function useResetData() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: boolean }>('/data/reset', {
        method: 'POST',
        body: JSON.stringify({ confirmation: 'RESET' }),
      }),
    onSuccess: () => {
      qc.clear()
    },
  })
}
