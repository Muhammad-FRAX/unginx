import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'
import type { Group } from '@unginx/shared'
import type { CreateGroupInput } from '@unginx/shared'

export function useGroups(kind?: 'proxy' | 'file') {
  return useQuery({
    queryKey: ['groups', kind],
    queryFn: () => apiFetch<Group[]>(`/groups${kind ? `?kind=${kind}` : ''}`),
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateGroupInput) =>
      apiFetch<Group>('/groups', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useUpdateGroup(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; description?: string | null }) =>
      apiFetch<Group>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['groups'] }),
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: 'move' | 'delete' }) =>
      apiFetch<void>(`/groups/${id}?mode=${mode}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: ['routes'] })
      qc.invalidateQueries({ queryKey: ['file-routes'] })
    },
  })
}
