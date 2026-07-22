import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const { login, user } = useAuth()
  const navigate = useNavigate()

  // Already logged in
  if (user) {
    navigate(user.rol === 'admin' ? '/admin/dashboard' : '/repartidor/dashboard')
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      const storedUser = JSON.parse(localStorage.getItem('floresta_user') ?? '{}') as { rol?: string; nombre?: string }
      toast.success(`Bienvenido/a, ${storedUser.nombre ?? ''}`)
      navigate(storedUser.rol === 'admin' ? '/admin/dashboard' : '/repartidor/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Credenciales inválidas')
    } finally {
      setLoading(false)
    }
  }

  
  return (
    <div className="min-h-screen bg-sage-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="https://laflorestafloreria.cl/wp-content/uploads/2025/01/cropped-cropped-logo-floresta-1.png"
            alt="La Floresta"
            className="h-14 w-auto object-contain mx-auto mb-2"
          />
          <p className="text-sm text-stone-500 mt-1">Florería · Los Ángeles, Chile</p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-serif text-stone-800 mb-6 text-center">Iniciar sesión</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Correo electrónico</label>
              <input id="email" type="email" className="input" placeholder="correo@floresta.cl" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña</label>
              <input id="password" type="password" className="input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-stone-400 mt-6">Sistema interno · La Floresta Florería</p>
      </div>
    </div>
  )
}
