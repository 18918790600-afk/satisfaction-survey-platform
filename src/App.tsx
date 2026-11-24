import { Routes, Route, Navigate } from 'react-router'
import { StoreProvider, useStore } from './lib/store'
import { Toaster } from './components/ui/sonner'
import Login from './pages/Login'
import Evaluate from './pages/Evaluate'
import PublicResults from './pages/PublicResults'
import AdminLayout from './pages/admin/AdminLayout'
import Overview from './pages/admin/Overview'
import Results from './pages/admin/Results'
import ParticipationPage from './pages/admin/Participation'
import Weights from './pages/admin/Weights'
import Logs from './pages/admin/Logs'
import Users from './pages/admin/Users'
import Staff from './pages/admin/Staff'
import type { ReactNode } from 'react'

function RequireAuth({ children, role }: { children: ReactNode; role?: 'admin' | 'employee' }) {
  const { currentUser } = useStore()
  if (!currentUser) return <Navigate to="/login" replace />
  if (role && currentUser.role !== role) {
    return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/evaluate'} replace />
  }
  return <>{children}</>
}

function HomeRedirect() {
  const { currentUser } = useStore()
  if (!currentUser) return <Navigate to="/login" replace />
  return <Navigate to={currentUser.role === 'admin' ? '/admin' : '/evaluate'} replace />
}

function Shell() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<HomeRedirect />} />
      <Route
        path="/evaluate"
        element={
          <RequireAuth role="employee">
            <Evaluate />
          </RequireAuth>
        }
      />
      <Route
        path="/results"
        element={
          <RequireAuth role="employee">
            <PublicResults />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAuth role="admin">
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<Overview />} />
        <Route path="results" element={<Results />} />
        <Route path="participation" element={<ParticipationPage />} />
        <Route path="weights" element={<Weights />} />
        <Route path="users" element={<Users />} />
        <Route path="staff" element={<Staff />} />
        <Route path="logs" element={<Logs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
      <Toaster position="top-center" richColors />
    </StoreProvider>
  )
}
