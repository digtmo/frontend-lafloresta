import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import type { Pedido } from '@/types'
import PedidoExpandido from '@/components/admin/PedidoExpandido'
import ModalNuevoPedido from '@/components/admin/ModalNuevoPedido'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import CalendarioPedidos from '@/components/admin/CalendarioPedidos'
import { apiFetch } from '@/lib/api'
import { Plus, Search, RefreshCw, ChevronDown, ChevronRight, CalendarDays, X, Calendar, List } from 'lucide-react'

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDias(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number)
  const fecha = new Date(y, m - 1, d + n)
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

function normalizarFecha(str: string): string | null {
  if (!str || !str.trim()) return null
  const s = str.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const dmyD = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/)
  if (dmyD) return `${dmyD[3]}-${dmyD[2].padStart(2, '0')}-${dmyD[1].padStart(2, '0')}`
  try {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  } catch { /* ignorar */ }
  return null
}

function etiquetaFecha(fechaISO: string, hoy: string): string {
  if (fechaISO === hoy)               return `Hoy · ${formatDia(fechaISO)}`
  if (fechaISO === addDias(hoy, 1))  return `Mañana · ${formatDia(fechaISO)}`
  if (fechaISO === addDias(hoy, -1)) return `Ayer · ${formatDia(fechaISO)}`
  if (fechaISO === addDias(hoy, 2))  return `Pasado mañana · ${formatDia(fechaISO)}`
  return formatDia(fechaISO)
}

function formatDia(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

const ESTADOS = [
  { value: 'todos',      label: 'Todos'       },
  { value: 'processing', label: 'Procesando'  },
  { value: 'completed',  label: 'Completados' },
]

type PresetKey = '7d' | '14d' | '30d' | 'todos' | 'custom'
const PRESETS: { key: PresetKey; label: string }[] = [
  { key: '7d',  label: 'Últimos 7 días'  },
  { key: '14d', label: 'Últimos 14 días' },
  { key: '30d', label: 'Últimos 30 días' },
]

function rangoPreset(key: PresetKey, custom?: { desde: string; hasta: string }): { desde: string; hasta: string } {
  const hoy = hoyLocal()
  switch (key) {
    case '7d':    return { desde: addDias(hoy, -7),   hasta: hoy }
    case '14d':   return { desde: addDias(hoy, -14),  hasta: hoy }
    case '30d':   return { desde: addDias(hoy, -30),  hasta: hoy }
    case 'todos': return { desde: addDias(hoy, -365), hasta: hoy }
    case 'custom': return custom ?? { desde: addDias(hoy, -7), hasta: hoy }
  }
}

export default function PedidosPage() {
  const [pedidos,      setPedidos]      = useState<Pedido[]>([])
  const [repartidores, setRepartidores] = useState<{ email: string; nombre: string }[]>([])
  const [loading,      setLoading]      = useState(true)
  const [estado,       setEstado]       = useState('todos')
  const [busqueda,     setBusqueda]     = useState('')
  const [busquedaDeb,  setBusquedaDeb]  = useState('')
  const [colapsadas,   setColapsadas]   = useState<Set<string>>(new Set())
  const [modalAbierto, setModalAbierto] = useState(false)
  const [vista,        setVista]        = useState<'lista' | 'calendario'>('lista')
  const [avisoCalendario, setAvisoCalendario] = useState(() => {
    try { return localStorage.getItem('aviso-calendario-v1') !== 'visto' } catch { return false }
  })

  function cerrarAviso() {
    setAvisoCalendario(false)
    try { localStorage.setItem('aviso-calendario-v1', 'visto') } catch { /* ignorar */ }
  }
  const [preset,       setPreset]       = useState<PresetKey>('7d')
  const [desde,        setDesde]        = useState(rangoPreset('7d').desde)
  const [hasta,        setHasta]        = useState(rangoPreset('7d').hasta)

  const tBusqueda = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (tBusqueda.current) clearTimeout(tBusqueda.current)
    tBusqueda.current = setTimeout(() => setBusquedaDeb(busqueda.trim()), 400)
    return () => { if (tBusqueda.current) clearTimeout(tBusqueda.current) }
  }, [busqueda])

  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('per_page', '100')
      if (busquedaDeb) {
        qs.set('search', busquedaDeb)
      } else {
        qs.set('desde', desde)
        qs.set('hasta', hasta)
      }

      const [dataPedidos, dataReps] = await Promise.all([
        apiFetch<{ pedidos: Pedido[] }>(`/api/pedidos?${qs}`),
        apiFetch<{ repartidores: { email: string; nombre: string }[] }>('/api/repartidores').catch(() => ({ repartidores: [] })),
      ])

      setPedidos(dataPedidos.pedidos)
      setRepartidores(dataReps.repartidores ?? [])
    } catch {
      if (!silent) toast.error('Error al cargar pedidos')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [desde, hasta, busquedaDeb])

  useEffect(() => { cargar() }, [cargar])

  // Auto-refresco discreto: el estado de WhatsApp (enviando → entregado → leído)
  // se actualiza por webhook después de enviar, así que reconsultamos la lista
  // periódicamente y al volver el foco a la pestaña sin mostrar el spinner.
  useEffect(() => {
    if (vista !== 'lista') return
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') cargar(true)
    }, 20_000)
    const onFocus = () => { if (document.visibilityState === 'visible') cargar(true) }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [cargar, vista])

  function aplicarPreset(key: PresetKey) {
    setPreset(key)
    if (key === 'custom') return
    const r = rangoPreset(key)
    setDesde(r.desde)
    setHasta(r.hasta)
  }

  function aplicarCustom() {
    if (!desde || !hasta) return
    if (desde > hasta) { toast.error('La fecha de inicio debe ser anterior a la final'); return }
    setPreset('custom')
    cargar()
  }

  const pedidosFiltrados = useMemo(() =>
    pedidos.filter((p) => estado === 'todos' || p.status === estado),
    [pedidos, estado]
  )

  const hoy = hoyLocal()

  const grupos = useMemo(() => {
    const mapa = new Map<string, Pedido[]>()
    for (const p of pedidosFiltrados) {
      const clave = normalizarFecha(p.meta.fechaEnvio) ?? '__sin_fecha__'
      const lista = mapa.get(clave) ?? []
      lista.push(p)
      mapa.set(clave, lista)
    }
    const claves = Array.from(mapa.keys()).sort((a, b) => {
      if (a === '__sin_fecha__') return 1
      if (b === '__sin_fecha__') return -1
      const aFuturo = a >= hoy
      const bFuturo = b >= hoy
      if (aFuturo && !bFuturo) return -1
      if (!aFuturo && bFuturo) return 1
      if (aFuturo) return a.localeCompare(b)
      return b.localeCompare(a)
    })
    return claves.map((clave) => {
      const lista = (mapa.get(clave) ?? []).sort((a, b) => {
        if (a.status === b.status) return 0
        return a.status === 'processing' ? -1 : 1
      })
      return { clave, esSinFecha: clave === '__sin_fecha__', pedidos: lista }
    })
  }, [pedidosFiltrados, hoy])

  function toggleSeccion(clave: string) {
    setColapsadas((prev) => {
      const next = new Set(prev)
      if (next.has(clave)) next.delete(clave)
      else next.add(clave)
      return next
    })
  }

  const total = pedidosFiltrados.length
  const buscando = !!busquedaDeb

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-serif text-stone-800">Pedidos</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {vista === 'calendario'
              ? 'Pedidos del mes por fecha de entrega'
              : loading ? 'Cargando…' : `${total} pedido${total !== 1 ? 's' : ''}${buscando ? ` · resultados de "${busquedaDeb}"` : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-stone-100 p-0.5">
            <button
              onClick={() => setVista('lista')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                vista === 'lista' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
              title="Vista de lista"
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => setVista('calendario')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                vista === 'calendario' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}
              title="Vista de calendario"
            >
              <CalendarDays className="w-4 h-4" />
              <span className="hidden sm:inline">Calendario</span>
            </button>
          </div>
          {vista === 'lista' && (
            <button onClick={() => cargar()} className="btn-outline" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button onClick={() => setModalAbierto(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nuevo pedido</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
        </div>
      </div>

      {vista === 'lista' && (
      <div className="card p-3 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              className="input pl-9 pr-9 w-full"
              placeholder="Buscar en todos los pedidos por nombre, email, #ID…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-stone-100 text-stone-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 shrink-0">
            {ESTADOS.map((e) => (
              <button
                key={e.value}
                onClick={() => setEstado(e.value)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  estado === e.value ? 'bg-black text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
        </div>

        {!buscando && (
          <div className="pt-3 border-t border-stone-100 space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => aplicarPreset(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    preset === p.key ? 'bg-black text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                Rango personalizado
              </div>
              <div className="flex flex-1 gap-2 items-center">
                <input
                  type="date" className="input flex-1 text-sm" value={desde} max={hasta}
                  onChange={(e) => { setDesde(e.target.value); setPreset('custom') }}
                />
                <span className="text-stone-400 text-sm">→</span>
                <input
                  type="date" className="input flex-1 text-sm" value={hasta} min={desde}
                  onChange={(e) => { setHasta(e.target.value); setPreset('custom') }}
                />
                <button onClick={aplicarCustom} className="btn-primary text-sm py-1.5">Aplicar</button>
              </div>
            </div>
          </div>
        )}

        {buscando && (
          <div className="text-xs text-stone-500 pt-1">
            Buscando en todos los pedidos. Limpia la búsqueda para volver al rango de fechas.
          </div>
        )}
      </div>
      )}

      {vista === 'calendario' ? (
        <CalendarioPedidos repartidores={repartidores} />
      ) : loading ? (
        <LoadingSpinner text="Cargando pedidos…" />
      ) : grupos.length === 0 ? (
        <EmptyState
          title="Sin pedidos"
          description={buscando ? 'No se encontraron resultados para tu búsqueda.' : 'No hay pedidos en el rango seleccionado.'}
        />
      ) : (
        <div className="space-y-8">
          {grupos.map(({ clave, esSinFecha, pedidos: listaPedidos }) => {
            const colapsado = colapsadas.has(clave)
            const etiqueta = esSinFecha ? 'Sin fecha de envío' : etiquetaFecha(clave, hoy)
            const headerColor = clave === hoy
              ? 'text-sage-700 border-sage-300'
              : clave === addDias(hoy, 1)
              ? 'text-rosa-600 border-rosa-300'
              : esSinFecha
              ? 'text-stone-400 border-stone-200'
              : clave < hoy
              ? 'text-stone-400 border-stone-100'
              : 'text-stone-600 border-stone-200'

            return (
              <section key={clave}>
                <button
                  onClick={() => toggleSeccion(clave)}
                  className={`flex items-center gap-2.5 w-full mb-3 border-b pb-2 group ${headerColor}`}
                >
                  <CalendarDays className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold capitalize tracking-wide flex-1 text-left">{etiqueta}</span>
                  <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-medium">
                    {listaPedidos.length} pedido{listaPedidos.length !== 1 ? 's' : ''}
                  </span>
                  {colapsado
                    ? <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
                    : <ChevronDown  className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
                  }
                </button>
                {!colapsado && (
                  <div className="space-y-3">
                    {listaPedidos.map((p) => (
                      <PedidoExpandido key={p.id} pedido={p} repartidores={repartidores} onActualizar={cargar} />
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      {modalAbierto && (
        <ModalNuevoPedido onClose={() => setModalAbierto(false)} onCreado={cargar} />
      )}

      {avisoCalendario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={cerrarAviso}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={cerrarAviso}
              className="absolute top-3 right-3 p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="w-14 h-14 rounded-full bg-sage-100 text-sage-600 flex items-center justify-center mx-auto mb-4">
              <CalendarDays className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-serif text-stone-800 mb-2">¡Nueva vista de calendario!</h2>
            <p className="text-sm text-stone-500 mb-6">
              Ahora puedes ver los pedidos del mes organizados por fecha de entrega.
              Pincha en un día para ver el detalle de sus pedidos.
            </p>
            <div className="flex gap-2">
              <button onClick={cerrarAviso} className="btn-outline flex-1 justify-center">Más tarde</button>
              <button
                onClick={() => { setVista('calendario'); cerrarAviso() }}
                className="btn-primary flex-1 justify-center"
              >
                Ir a ver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
