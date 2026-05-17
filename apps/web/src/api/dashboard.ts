import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client.js'

export interface DashboardData {
  nginx: { running: boolean; pid: number | null }
  configVersion: number
  appVersion: string
  counts: {
    routes: { total: number; enabled: number; disabled: number }
    fileRoutes: { total: number; enabled: number; disabled: number }
    groups: number
  }
  recentActivity: Array<{
    version: number
    summary: string
    created_at: number
    created_by: string | null
  }>
}

export interface HealthStatus {
  routes: Array<{ id: string; name: string; kind: 'route'; status: string }>
  fileRoutes: Array<{ id: string; name: string; kind: 'file_route'; status: string }>
}

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch<DashboardData>('/dashboard'),
    refetchInterval: 30_000,
  })
}

export function useHealthStatus() {
  return useQuery({
    queryKey: ['health-status'],
    queryFn: () => apiFetch<HealthStatus>('/health-status'),
    refetchInterval: 30_000,
  })
}
