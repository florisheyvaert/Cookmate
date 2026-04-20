import { api } from '@/lib/api'

export type SetupStatus = { needsSetup: boolean }

export const setupApi = {
  status: () => api<SetupStatus>('/api/Setup/status'),

  complete: (email: string, password: string) =>
    api<void>('/api/Setup', {
      method: 'POST',
      json: { email, password },
    }),
}
