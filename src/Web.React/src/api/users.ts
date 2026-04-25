import { api } from '@/lib/api'

export type UserSummary = {
  id: string
  email: string
  roles: string[]
  isAdmin: boolean
  hasPassword: boolean
}

export type RedemptionLink = {
  userId: string
  email: string
  token: string
}

/**
 * Builds the URL the admin shares from the redemption token. Composed on the
 * client so the host matches whatever origin the admin is browsing — Vite
 * dev port, prod domain, reverse proxy.
 */
export function redemptionUrl(link: RedemptionLink): string {
  const params = new URLSearchParams({
    u: link.userId,
    t: link.token,
    e: link.email,
  })
  return `${window.location.origin}/redeem?${params.toString()}`
}

export type Me = {
  id: string
  email: string
  roles: string[]
}

export const usersApi = {
  me: () => api<Me>('/api/Users/me'),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api<void>('/api/Users/me/password', {
      method: 'POST',
      json: { currentPassword, newPassword },
    }),

  list: () => api<UserSummary[]>('/api/Users/directory'),

  invite: (email: string, isAdmin: boolean) =>
    api<RedemptionLink>('/api/Users/directory', {
      method: 'POST',
      json: { email, isAdmin },
    }),

  resetPassword: (userId: string) =>
    api<RedemptionLink>(`/api/Users/directory/${encodeURIComponent(userId)}/reset`, {
      method: 'POST',
      json: {},
    }),

  setAdmin: (userId: string, isAdmin: boolean) =>
    api<void>(`/api/Users/directory/${encodeURIComponent(userId)}/admin`, {
      method: 'POST',
      json: { isAdmin },
    }),

  remove: (userId: string) =>
    api<void>(`/api/Users/directory/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
    }),

  redeem: (userId: string, token: string, password: string) =>
    api<void>('/api/Users/redeem', {
      method: 'POST',
      json: { userId, token, password },
    }),
}
