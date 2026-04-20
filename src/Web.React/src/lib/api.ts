export class ApiError extends Error {
  readonly status: number
  readonly body: unknown

  constructor(status: number, body: unknown) {
    super(`HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

type ApiInit = Omit<RequestInit, 'body'> & {
  json?: unknown
  body?: BodyInit | null
}

export async function api<T = unknown>(path: string, init?: ApiInit): Promise<T> {
  const headers = new Headers(init?.headers)

  let body = init?.body
  if (init?.json !== undefined) {
    body = JSON.stringify(init.json)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }
  }

  const res = await fetch(path, {
    ...init,
    body,
    headers,
    credentials: 'include',
  })

  if (!res.ok) {
    const errorBody = await res.json().catch(() => null)
    throw new ApiError(res.status, errorBody)
  }

  if (res.status === 204) return undefined as T

  const contentType = res.headers.get('Content-Type') ?? ''
  if (!contentType.includes('json')) return undefined as T

  return (await res.json()) as T
}
