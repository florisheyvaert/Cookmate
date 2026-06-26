import { api } from '@/lib/api'

export type ExternalProvider = {
  scheme: string
  displayName: string
}

export const externalLoginApi = {
  /** Enabled OIDC providers, used to render a sign-in button per provider. */
  listProviders: () => api<ExternalProvider[]>('/api/ExternalLogin/providers'),

  /**
   * Full-page navigation that hands the browser to the identity provider. Not a
   * fetch — the OIDC flow is a series of top-level redirects that ends with the
   * server setting the Identity cookie and redirecting back to {@link returnUrl}.
   */
  challengeUrl: (scheme: string, returnUrl = '/') =>
    `/api/ExternalLogin/${encodeURIComponent(scheme)}/challenge?returnUrl=${encodeURIComponent(returnUrl)}`,
}
