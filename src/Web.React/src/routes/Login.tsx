import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/auth/AuthContext'
import { ApiError } from '@/lib/api'
import { AuthForm } from '@/components/AuthForm'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(email: string, password: string) {
    setError(null)
    setIsSubmitting(true)
    try {
      await login(email, password)
      // Always land on the home planner after signing in.
      navigate('/', { replace: true })
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
