import type { ReactNode } from 'react'
import { Route, Routes } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { AuthProvider } from '@/auth/AuthContext'
import { RequireAuth } from '@/auth/RequireAuth'
import { RequireAdmin } from '@/auth/RequireAdmin'
import { ConfirmProvider } from '@/components/confirm/ConfirmDialog'
import { ThemeProvider } from '@/components/ThemeProvider'
import { setupApi } from '@/api/setup'
import Layout from '@/routes/Layout'
import Home from '@/routes/Home'
import Recipes from '@/routes/Recipes'
import RecipeDetail from '@/routes/RecipeDetail'
import RecipeNew from '@/routes/RecipeNew'
import RecipeEdit from '@/routes/RecipeEdit'
import CookMode from '@/routes/CookMode'
import Login from '@/routes/Login'
import Setup from '@/routes/Setup'
import Users from '@/routes/Users'
import Redeem from '@/routes/Redeem'

export default function App() {
  return (
    <ThemeProvider>
      <SetupGate>
        <AuthProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="redeem" element={<Redeem />} />
              <Route element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="login" element={<Login />} />
                <Route
                  path="users"
                  element={
                    <RequireAdmin>
                      <Users />
                    </RequireAdmin>
                  }
                />
                <Route
                  path="recipes"
                  element={
                    <RequireAuth>
                      <Recipes />
                    </RequireAuth>
                  }
                />
                <Route
                  path="recipes/new"
                  element={
                    <RequireAuth>
                      <RecipeNew />
                    </RequireAuth>
                  }
                />
                <Route
                  path="recipes/:id"
                  element={
                    <RequireAuth>
                      <RecipeDetail />
                    </RequireAuth>
                  }
                />
                <Route
                  path="recipes/:id/edit"
                  element={
                    <RequireAuth>
                      <RecipeEdit />
                    </RequireAuth>
                  }
                />
              </Route>
              <Route
                path="recipes/:id/cook"
                element={
                  <RequireAuth>
                    <CookMode />
                  </RequireAuth>
                }
              />
            </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </SetupGate>
    </ThemeProvider>
  )
}

/**
 * Checks first-run setup status before the rest of the app renders. While the
 * backend reports an empty user table, every route collapses into the onboarding
 * screen — the user can't navigate away until setup is done.
 */
function SetupGate({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: ['setup-status'],
    queryFn: () => setupApi.status(),
    retry: false,
    staleTime: Infinity,
  })

  if (query.isPending) return <BootingScreen />
  if (query.isError) return <BootErrorScreen />

  if (query.data.needsSetup) {
    return (
      <Routes>
        <Route path="*" element={<Setup />} />
      </Routes>
    )
  }

  return <>{children}</>
}

function BootingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="eyebrow">Heating up…</p>
    </div>
  )
}

function BootErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <p className="eyebrow text-paprika mb-3">Kitchen is closed</p>
        <p className="text-ink-soft text-lg leading-relaxed">
          Could not reach the API. Start the backend and refresh the page.
        </p>
      </div>
    </div>
  )
}
