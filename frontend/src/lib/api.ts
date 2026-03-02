import { ListResponse, StorageStats, FileItem } from '../types'

// 开发时使用代理，生产时指向 Worker 域名
const API_BASE = import.meta.env.VITE_API_BASE ?? ''

function getToken(): string | null {
  return localStorage.getItem('r2drive_token')
}

function setToken(token: string): void {
  localStorage.setItem('r2drive_token', token)
}

function clearToken(): void {
  localStorage.removeItem('r2drive_token')
}

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const data = await res.json() as { error?: string }
      message = data.error ?? message
    } catch {
      // ignore
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<T>
}

export const api = {
  // 鉴权
  async login(username: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      throw new ApiError(res.status, data.error ?? 'Login failed')
    }

    const data = await res.json() as { token: string }
    setToken(data.token)
  },

  logout(): void {
    clearToken()
  },

  async checkAuth(): Promise<boolean> {
    try {
      await request('/api/auth/me')
      return true
    } catch {
      return false
    }
  },

  // 文件操作
  listFiles(prefix = ''): Promise<ListResponse> {
    return request(`/api/files?prefix=${encodeURIComponent(prefix)}`)
  },

  listAllFiles(): Promise<{ files: FileItem[] }> {
    return request('/api/files/all')
  },

  async uploadFile(
    file: File,
    prefix: string,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = getToken()
      const formData = new FormData()
      formData.append('file', file)
      formData.append('prefix', prefix)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/api/files/upload`)

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      }

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else if (xhr.status === 401) {
          clearToken()
          window.location.href = '/login'
          reject(new ApiError(401, 'Unauthorized'))
        } else {
          let message = `HTTP ${xhr.status}`
          try {
            const data = JSON.parse(xhr.responseText) as { error?: string }
            message = data.error ?? message
          } catch {
            // ignore
          }
          reject(new ApiError(xhr.status, message))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))

      xhr.send(formData)
    })
  },

  deleteFiles(keys: string[]): Promise<{ success: boolean; deleted: number }> {
    return request('/api/files', {
      method: 'DELETE',
      body: JSON.stringify({ keys }),
    })
  },

  createFolder(path: string): Promise<{ success: boolean }> {
    return request('/api/files/folder', {
      method: 'POST',
      body: JSON.stringify({ path }),
    })
  },

  renameFile(oldKey: string, newKey: string): Promise<{ success: boolean }> {
    return request('/api/files/rename', {
      method: 'POST',
      body: JSON.stringify({ oldKey, newKey }),
    })
  },

  getDownloadUrl(key: string): string {
    const token = getToken()
    return `${API_BASE}/api/files/download?key=${encodeURIComponent(key)}&token=${token ?? ''}`
  },

  getPreviewUrl(key: string): string {
    const token = getToken()
    return `${API_BASE}/api/files/preview?key=${encodeURIComponent(key)}&token=${token ?? ''}`
  },

  getStats(): Promise<StorageStats> {
    return request('/api/files/stats')
  },

  // 简易上传（存到 drive/{year}{month}/，带哈希命名）
  quickUpload(
    file: File,
    onProgress: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const token = getToken()
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/api/files/quick-upload`)
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else if (xhr.status === 401) {
          clearToken()
          window.location.href = '/login'
          reject(new ApiError(401, 'Unauthorized'))
        } else {
          let message = `HTTP ${xhr.status}`
          try { const d = JSON.parse(xhr.responseText) as { error?: string }; message = d.error ?? message } catch { /* ignore */ }
          reject(new ApiError(xhr.status, message))
        }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
      xhr.send(formData)
    })
  },

  // 生成 24 小时上传链接
  createUploadLink(): Promise<{ token: string; expiresAt: string }> {
    return request('/api/share/create-upload-link', { method: 'POST' })
  },

  // 公开上传（使用 token，不带 auth header）
  publicUpload(
    token: string,
    file: File,
    onProgress: (percent: number) => void
  ): Promise<{ key: string; name: string; size: number }> {
    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${API_BASE}/api/share/upload?token=${encodeURIComponent(token)}`)

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText) as { key: string; name: string; size: number })
        } else {
          let message = `HTTP ${xhr.status}`
          try { const d = JSON.parse(xhr.responseText) as { error?: string }; message = d.error ?? message } catch { /* ignore */ }
          reject(new ApiError(xhr.status, message))
        }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.addEventListener('abort', () => reject(new Error('Upload aborted')))
      xhr.send(formData)
    })
  },
}
