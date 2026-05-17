import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'

export interface VersionSummary {
  id: number
  version: number
  summary: string
  created_at: number
  created_by: string | null
}

export interface VersionDetail extends VersionSummary {
  snapshot: { routes: unknown[]; fileRoutes: unknown[] }
  diff: { added: unknown[]; removed: unknown[]; changed: unknown[] }
}

export function useVersions() {
  return useQuery({
    queryKey: ['versions'],
    queryFn: () => apiFetch<VersionSummary[]>('/versions'),
  })
}

export function useVersionDetail(v: number | null) {
  return useQuery({
    queryKey: ['versions', v],
    queryFn: () => apiFetch<VersionDetail>(`/versions/${v}`),
    enabled: v !== null,
  })
}

export function useRollback() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: number) => apiFetch<{ ok: boolean; newVersion: number }>(`/versions/${v}/rollback`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['versions'] })
      qc.invalidateQueries({ queryKey: ['routes'] })
      qc.invalidateQueries({ queryKey: ['file-routes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}
