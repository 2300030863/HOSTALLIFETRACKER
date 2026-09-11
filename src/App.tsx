import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { ToastContainer } from '@/components/ui/Toast'
import { Loader2 } from 'lucide-react'

// Lazy load pages
const WelcomePage = lazy(() => import('@/pages/WelcomePage'))
const Login = lazy(() => import('@/pages/Login'))
const Register = lazy(() => import('@/pages/Register'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword'))
const Today = lazy(() => import('@/pages/Today'))
const MoneyPage = lazy(() => import('@/pages/MoneyPage'))
const PeoplePage = lazy(() => import('@/pages/PeoplePage'))
const ActivitiesPage = lazy(() => import('@/pages/ActivitiesPage'))
const RemindersPage = lazy(() => import('@/pages/RemindersPage'))
const GoalsPage = lazy(() => import('@/pages/GoalsPage'))
const ReportsPage = lazy(() => import('@/pages/ReportsPage'))

// Loading spinner for suspense
function PageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-50 dark:bg-surface-950">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        <p className="text-sm text-surface-500">Loading...</p>
      </div>
    </div>
  )
}

// Redirect authenticated users away from auth pages to dashboard
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth()

  if (!initialized || loading) return <PageLoader />
  if (user) return <Navigate to="/today" replace />

  return <>{children}</>
}

// Protect routes that require authentication
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, initialized } = useAuth()

  if (!initialized || loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Primary Root Route: Show Welcome Page First */}
        <Route path="/" element={<WelcomePage />} />
        <Route path="/welcome" element={<WelcomePage />} />

        {/* Public auth routes */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected app dashboard routes */}
        <Route path="/today" element={<PrivateRoute><Today /></PrivateRoute>} />
        <Route path="/money" element={<PrivateRoute><MoneyPage /></PrivateRoute>} />
        <Route path="/people" element={<PrivateRoute><PeoplePage /></PrivateRoute>} />
        <Route path="/activities" element={<PrivateRoute><ActivitiesPage /></PrivateRoute>} />
        <Route path="/reminders" element={<PrivateRoute><RemindersPage /></PrivateRoute>} />
        <Route path="/goals" element={<PrivateRoute><GoalsPage /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><ReportsPage /></PrivateRoute>} />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  )
}
