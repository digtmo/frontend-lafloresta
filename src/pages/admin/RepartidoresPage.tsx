import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '@/lib/api'
import { Loader2, Plus, Truck, User, Pencil, Trash2, RotateCcw, X, Check } from 'lucide-react'

interface Repartidor {
  email:      string
  nombre:     string
  activo:     boolean
  pedidosHoy: number
}

export default function RepartidoresPage() {
  const [repartidores, setRepartidores] = useState<Repartidor[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)

  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [password,  setPassword]  = useState('')
  const [guardando, setGuardando] = useState(false)

  const [editEmail,     setEditEmail]     = useState<string | null>(null)
  const [editNombre,    setEditNombre]    = useState('')
  const [editEmailVal,  setEditEmailVal]  = useState('')
  const [editPassword,  setEditPassword]  = useState('')
  const [editGuardando, setEditGuardando] = useState(false)

  async function cargar() {
    setLoading(true)
    try {
      const data = await apiFetch<{ repartidores: Repartidor[] }>('/api/repartidores?incluirInactivos=1')
      setRepartidores(data.repartidores)
    } catch {
      toast.error('Error al cargar repartidores')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !email.trim() || !password) { toast.error('Nombre, correo y contraseña requeridos'); return }
    if (password.length < 6) { toast.error('La contraseña debe tener al menos 6 caracteres'); return }
    setGuardando(true)
    try {
      await apiFetch('/api/repartidores', {
        method: 'POST',
        body: JSON.stringify({ nombre: nombre.trim(), email: email.trim(), password }),
      })
      toast.success('Repartidor agregado')
      setNombre(''); setEmail(''); setPassword('')
      setShowForm(false)
      cargar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al agregar repartidor')
    } finally {
      setGuardando(false)
    }
  }

  function iniciarEdicion(r: Repartidor) {
    setEditEmail(r.email)
    setEditNombre(r.nombre)
    setEditEmailVal(r.email)
    setEditPassword('')
  }

  function cancelarEdicion() {
    setEditEmail(null)
    setEditNombre(''); setEditEmailVal(''); setEditPassword('')
  }

  async function guardarEdicion(emailOriginal: string) {
    if (!editNombre.trim() || !editEmailVal.trim()) { toast.error('Nombre y correo requeridos'); return }
    if (editPassword && editPassword.length < 6) { toast.error('La contraseña nueva debe tener al menos 6 caracteres'); return }
    setEditGuardando(true)
    try {
      const body: Record<string, unknown> = { nombre: editNombre.trim(), email: editEmailVal.trim() }
      if (editPassword) body.password = editPassword
      await apiFetch(`/api/repartidores/${encodeURIComponent(emailOriginal)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      toast.success('Repartidor actualizado')
      cancelarEdicion()
      cargar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al actualizar')
    } finally {
      setEditGuardando(false)
    }
  }

  async function cambiarActivo(emailObjetivo: string, activo: boolean) {
    if (!confirm(`¿${activo ? 'Reactivar' : 'Desactivar'} este repartidor?`)) return
    try {
      await apiFetch(`/api/repartidores/${encodeURIComponent(emailObjetivo)}`, {
        method: activo ? 'PATCH' : 'DELETE',
        body: activo ? JSON.stringify({ activo: true }) : undefined,
      })
      toast.success(activo ? 'Repartidor reactivado' : 'Repartidor desactivado')
      cargar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : `Error al ${activo ? 'reactivar' : 'desactivar'}`)
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-stone-800">Repartidores</h1>
          <p className="text-sm text-stone-500 mt-0.5">Equipo de reparto</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary">
          <Plus className="w-4 h-4" />
          Agregar repartidor
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleAgregar} className="card p-5 mb-5">
          <p className="section-title">Nuevo repartidor</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Nombre</label>
              <input className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Pedro" />
            </div>
            <div>
              <label className="label">Correo electrónico</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pedro@floresta.cl" />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" value={password} minLength={6} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={guardando}>
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar
            </button>
            <button type="button" className="btn-outline" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
          <p className="text-xs text-stone-400 mt-3">
            El repartidor podrá iniciar sesión con este correo y contraseña.
          </p>
        </form>
      )}

      {loading ? (
        <div className="card p-8 flex items-center justify-center gap-2 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin" /> Cargando…
        </div>
      ) : (
        <div className="card divide-y divide-stone-100">
          {repartidores.length === 0 && (
            <div className="p-8 text-center text-stone-400">No hay repartidores registrados.</div>
          )}
          {repartidores.map((r) => {
            const editando = editEmail === r.email
            return (
              <div key={r.email} className={`px-5 py-4 ${!r.activo ? 'opacity-60' : ''}`}>
                {editando ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label">Nombre</label>
                        <input className="input" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Correo</label>
                        <input className="input" type="email" value={editEmailVal} onChange={(e) => setEditEmailVal(e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Nueva contraseña</label>
                        <input className="input" type="password" value={editPassword} minLength={6}
                          onChange={(e) => setEditPassword(e.target.value)} placeholder="(dejar vacío para no cambiar)" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => guardarEdicion(r.email)} disabled={editGuardando} className="btn-primary">
                        {editGuardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        Guardar
                      </button>
                      <button onClick={cancelarEdicion} className="btn-outline">
                        <X className="w-4 h-4" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-salvia-100 flex items-center justify-center shrink-0">
                      <User className="w-5 h-5 text-salvia-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-stone-800 truncate">{r.nombre}</p>
                        {!r.activo && (
                          <span className="inline-flex items-center text-[10px] uppercase tracking-wide bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">
                            Inactivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-400 truncate">{r.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 text-sm shrink-0">
                      <Truck className="w-4 h-4 text-stone-300" />
                      <span className="font-semibold text-stone-700">{r.pedidosHoy}</span>
                      <span className="text-stone-400 text-xs">hoy</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => iniciarEdicion(r)} title="Editar" className="p-2 rounded-lg text-stone-500 hover:bg-stone-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {r.activo ? (
                        <button onClick={() => cambiarActivo(r.email, false)} title="Desactivar" className="p-2 rounded-lg text-red-500 hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => cambiarActivo(r.email, true)} title="Reactivar" className="p-2 rounded-lg text-green-600 hover:bg-green-50">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
