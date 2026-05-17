import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'
import type { Route } from '@unginx/shared'
import type { CreateRouteInput } from '@unginx/shared'

export function useRoutes(params?: { group_id?: string | null; enabled?: boolean }) {
  const qs = new URLSearchParams()
  if (params?.group_id !== undefined) {
    qs.set('group_id', params.group_id === null ? 'null' : params.group_id)
  }
  if (params?.enabled !== undefined) qs.set('enabled', String(params.enabled))
  return useQuery({
    queryKey: ['routes', params],
    queryFn: () => apiFetch<Route[]>(`/routes?${qs.toString()}`),
  })
}

export function useAllRoutes() {
  return useQuery({
    queryKey: ['routes', 'all'],
    queryFn: () => apiFetch<Route[]>('/routes'),
  })
}

export function useCreateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateRouteInput) =>
      apiFetch<Route>('/routes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}

export function useUpdateRoute(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CreateRouteInput>) =>
      apiFetch<Route>(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}

export function useDeleteRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}

export function useToggleRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch<Route>(`/routes/${id}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}

export function useDuplicateRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<Route>(`/routes/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}

export function useMoveRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, group_id }: { id: string; group_id: string | null }) =>
      apiFetch<Route>(`/routes/${id}/move`, { method: 'POST', body: JSON.stringify({ group_id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}

export function useBulkRoutes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { ids: string[]; action: string; group_id?: string | null }) =>
      apiFetch<void>('/routes/bulk', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['routes'] }),
  })
}
