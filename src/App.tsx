import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import LoginPage from './pages/auth/LoginPage'

import AdminShell from './components/admin/AdminShell'
import DashboardPage from './pages/admin/DashboardPage'
import PedidosPage from './pages/admin/PedidosPage'
import RepartidoresPage from './pages/admin/RepartidoresPage'
import CrmPage from './pages/admin/CrmPage'
import TokensPage from './pages/admin/TokensPage'
import WhatsappTestPage from './pages/admin/WhatsappTestPage'

import RepartidorLayout from './components/repartidor/RepartidorLayout'
import RepartidorDashboardPage from './pages/repartidor/RepartidorDashboardPage'
import EntregaDetailPage from './pages/repartidor/EntregaDetailPage'

import PedidoPublicoPage from './pages/pedido/PedidoPublicoPage'

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/auth/login" replace />
  if (user.rol === 'admin') return <Navigate to="/admin/dashboard" replace />
  return <Navigate to="/repartidor/dashboard" replace />
}

function RequireAuth({ children, rol }: { children: React.ReactNode; rol?: 'admin' | 'repartidor' }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/auth/login" replace />
  if (rol && user.rol !== rol) {
    return user.rol === 'admin'
      ? <Navigate to="/admin/dashboard" replace />
      : <Navigate to="/repartidor/dashboard" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/pedido/:token" element={<PedidoPublicoPage />} />

        <Route
          path="/admin"
          element={
            <RequireAuth rol="admin">
              <AdminShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard"   element={<DashboardPage />} />
          <Route path="pedidos"     element={<PedidosPage />} />
          <Route path="repartidores" element={<RepartidoresPage />} />
          <Route path="crm"         element={<CrmPage />} />
          <Route path="tokens"      element={<TokensPage />} />
          <Route path="whatsapp-test" element={<WhatsappTestPage />} />
        </Route>

        <Route
          path="/repartidor"
          element={
            <RequireAuth rol="repartidor">
              <RepartidorLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/repartidor/dashboard" replace />} />
          <Route path="dashboard"     element={<RepartidorDashboardPage />} />
          <Route path="entrega/:id"   element={<EntregaDetailPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
