import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '@/auth/AuthContext'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="px-6 md:px-12 lg:px-20 py-20">
        <p className="eyebrow">Loading the kitchen…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!isAdmin) {
    return (
      <div className="px-6 md:px-12 lg:px-20 py-20">
        <p className="eyebrow text-paprika mb-3">Pantry locked</p>
        <p className="text-ink-soft text-lg">
          Only an administrator can manage cookbook keys.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
