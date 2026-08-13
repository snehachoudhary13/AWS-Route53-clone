const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"
export const API_BASE_URL = rawApiUrl.endsWith("/api")
  ? rawApiUrl
  : `${rawApiUrl.replace(/\/+$/, "")}/api`


export function setAuthToken(token: string) {
  if (typeof window !== "undefined") {
    // Set cookie valid for 8 hours (28800 seconds)
    document.cookie = `auth_token=${token}; path=/; max-age=28800; SameSite=Lax`
    localStorage.setItem("auth_token", token)
  }
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null
  
  const cookieMatch = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)
  if (cookieMatch) return cookieMatch[1]
  
  return localStorage.getItem("auth_token")
}

export function removeAuthToken() {
  if (typeof window !== "undefined") {
    document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT"
    localStorage.removeItem("auth_token")
  }
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken()
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    removeAuthToken()
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login"
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Request failed with status ${response.status}`)
  }

  return response.json()
}
