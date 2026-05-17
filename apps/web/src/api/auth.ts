import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client.js'
import type { User } from '@unginx/shared'

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<User>('/me'),
    retry: false,
  })
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiFetch<{ mustChangePassword?: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      // Match the SPA's basename so we land on the React Router /login route.
      window.location.href = '/__unginx/login'
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      apiFetch<{ ok: boolean }>('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })
}
