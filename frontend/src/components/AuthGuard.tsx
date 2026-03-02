import { useEffect, useState, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../lib/api'

export function AuthGuard({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'unauth'>('checking')

  useEffect(() => {
    api.checkAuth().then((ok) => setStatus(ok ? 'ok' : 'unauth'))
  }, [])

  if (status === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (status === 'unauth') {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
