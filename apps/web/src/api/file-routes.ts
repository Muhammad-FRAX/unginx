import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'
import type { FileRoute } from '@unginx/shared'
import type { CreateFileRouteInput } from '@unginx/shared'

export function useAllFileRoutes() {
  return useQuery({
    queryKey: ['file-routes', 'all'],
    queryFn: () => apiFetch<FileRoute[]>('/file-routes'),
  })
}

export function useCreateFileRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFileRouteInput) =>
      apiFetch<FileRoute>('/file-routes', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-routes'] }),
  })
}

export function useUpdateFileRoute(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<CreateFileRouteInput>) =>
      apiFetch<FileRoute>(`/file-routes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-routes'] }),
  })
}

export function useDeleteFileRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/file-routes/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-routes'] }),
  })
}

export function useToggleFileRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      apiFetch<FileRoute>(`/file-routes/${id}/${enabled ? 'enable' : 'disable'}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-routes'] }),
  })
}

export function useMoveFileRoute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, group_id }: { id: string; group_id: string | null }) =>
      apiFetch<FileRoute>(`/file-routes/${id}/move`, { method: 'POST', body: JSON.stringify({ group_id }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['file-routes'] }),
  })
}
