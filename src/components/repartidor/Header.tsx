import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'

export default function Header({ nombre }: { nombre: string }) {
  const navigate = useNavigate()
  const { logout } = useAuth()

  function handleLogout() {
    logout()
    toast.success('Sesión cerrada')
    navigate('/auth/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-stone-950 border-b border-stone-800 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="https://laflorestafloreria.cl/wp-content/uploads/2025/01/cropped-cropped-logo-floresta-1.png"
            alt="La Floresta"
            className="h-8 w-auto object-contain brightness-0 invert"
          />
          <div className="h-5 w-px bg-stone-700" />
          <p className="text-sm font-medium text-stone-200">{nombre}</p>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-stone-400 hover:text-red-400 transition-colors">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Salir</span>
        </button>
      </div>
    </header>
  )
}
