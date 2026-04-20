import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthForm } from '@/components/AuthForm'

type LocationState = { from?: { pathname: string } } | null

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(email: string, password: string) {
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      const state = location.state as LocationState
      navigate(state?.from?.pathname ?? '/recipes', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Email or password not recognised.')
      } else {
        setError('Something went wrong. Try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthForm
      eyebrow="Welcome back"
      title="Back in the kitchen."
      italicWord="kitchen"
      quote="A kitchen worth coming back to."
      submitLabel="Sign in"
      isSubmitting={isSubmitting}
      error={error}
      onSubmit={handleSubmit}
    />
  )
}
