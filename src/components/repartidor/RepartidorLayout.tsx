import { Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import Header from './Header'

export default function RepartidorLayout() {
  const { user } = useAuth()
  return (
    <div className="min-h-screen bg-stone-50">
      <Header nombre={user?.nombre ?? ''} />
      <main className="max-w-lg mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
