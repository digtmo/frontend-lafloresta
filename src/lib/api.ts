const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

function getToken(): string | null {
  return localStorage.getItem('floresta_token')
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${API_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('floresta_token')
    localStorage.removeItem('floresta_user')
    window.location.href = '/auth/login'
    throw new Error('Sesión expirada')
  }

  if (!res.ok) {
    let msg = `Error ${res.status}`
    try {
      const body = await res.json() as { error?: string }
      if (body.error) msg = body.error
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  return res.json() as Promise<T>
}

/** Returns the base API URL — useful for EventSource (SSE) URLs */
export function apiUrl(path: string): string {
  return `${API_URL}${path}`
}
