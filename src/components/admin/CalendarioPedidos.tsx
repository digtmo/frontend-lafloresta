import { useCallback, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { Pedido } from '@/types'
import PedidoExpandido from '@/components/admin/PedidoExpandido'
import { apiFetch } from '@/lib/api'
import { ChevronLeft, ChevronRight, CalendarDays, X, Loader2 } from 'lucide-react'

function hoyLocal(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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

function isoDeFecha(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

function formatDiaLargo(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-CL', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

interface Props {
  repartidores: { email: string; nombre: string }[]
}

interface Celda {
  iso: string
  dia: number
  otroMes: boolean
}

export default function CalendarioPedidos({ repartidores }: Props) {
  const hoy = useMemo(hoyLocal, [])
  // Mes visible: primer día del mes. Arranca en el mes de "hoy".
  const [mes, setMes] = useState(() => {
    const [y, m] = hoy.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [diaSel, setDiaSel] = useState<string | null>(null)

  // Carga todos los pedidos cuya fecha de entrega cae en el mes visible.
  const cargar = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const year  = mes.getFullYear()
      const month = mes.getMonth() + 1
      const data  = await apiFetch<{ pedidos: Pedido[] }>(`/api/pedidos/calendario?year=${year}&month=${month}`)
      setPedidos(data.pedidos)
    } catch {
      if (!silent) toast.error('Error al cargar el calendario')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [mes])

  useEffect(() => { cargar() }, [cargar])

  // Auto-refresco discreto para reflejar cambios de estado (p. ej. WhatsApp).
  useEffect(() => {
    const iv = setInterval(() => {
      if (document.visibilityState === 'visible') cargar(true)
    }, 20_000)
    return () => clearInterval(iv)
  }, [cargar])

  // Cerrar el modal con la tecla Escape
  useEffect(() => {
    if (!diaSel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setDiaSel(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [diaSel])

  // Mapa fecha ISO → pedidos de ese día
  const porDia = useMemo(() => {
    const mapa = new Map<string, Pedido[]>()
    for (const p of pedidos) {
      const clave = normalizarFecha(p.meta.fechaEnvio)
      if (!clave) continue
      const lista = mapa.get(clave) ?? []
      lista.push(p)
      mapa.set(clave, lista)
    }
    return mapa
  }, [pedidos])

  // Genera la grilla del mes (semanas empezando en lunes)
  const celdas = useMemo<Celda[]>(() => {
    const year = mes.getFullYear()
    const month = mes.getMonth()
    const primero = new Date(year, month, 1)
    // offset lunes: getDay() 0=Dom..6=Sáb → queremos 0=Lun..6=Dom
    const offset = (primero.getDay() + 6) % 7
    const inicio = new Date(year, month, 1 - offset)
    const cells: Celda[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i)
      cells.push({ iso: isoDeFecha(d), dia: d.getDate(), otroMes: d.getMonth() !== month })
    }
    // Recortar la última semana si queda completamente fuera del mes
    while (cells.length >= 35 && cells.slice(-7).every((c) => c.otroMes)) {
      cells.splice(-7)
    }
    return cells
  }, [mes])

  const tituloMes = mes.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  const pedidosDelDia = diaSel ? (porDia.get(diaSel) ?? []) : []

  function cambiarMes(delta: number) {
    setMes((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1))
  }

  function irHoy() {
    const [y, m] = hoy.split('-').map(Number)
    setMes(new Date(y, m - 1, 1))
    setDiaSel(hoy)
  }

  return (
    <div className="space-y-5">
      <div className="card p-3 sm:p-4">
        {/* Cabecera del mes */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => cambiarMes(-1)} className="btn-outline p-2" title="Mes anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-serif text-stone-800 capitalize">{tituloMes}</h2>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
            <button onClick={irHoy} className="text-xs px-2 py-1 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 font-medium">
              Hoy
            </button>
          </div>
          <button onClick={() => cambiarMes(1)} className="btn-outline p-2" title="Mes siguiente">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Nombres de días */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
          {DIAS_SEMANA.map((d) => (
            <div key={d} className="text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wide py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Grilla de días */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {celdas.map((c) => {
            const lista = (porDia.get(c.iso) ?? [])
              .slice()
              .sort((a, b) => (a.status === b.status ? 0 : a.status === 'processing' ? -1 : 1))
            const cantidad = lista.length
            const esHoy = c.iso === hoy
            const seleccionado = c.iso === diaSel
            const MAX = 3
            return (
              <button
                key={c.iso}
                onClick={() => setDiaSel(c.iso)}
                className={[
                  'relative min-h-[64px] sm:min-h-[118px] rounded-lg border p-1 sm:p-1.5 flex flex-col items-stretch text-left transition-colors overflow-hidden',
                  c.otroMes ? 'bg-stone-50/50 border-stone-100' : 'bg-white border-stone-200 hover:border-stone-300',
                  seleccionado ? '!border-sage-400 ring-1 ring-sage-300' : '',
                  esHoy && !seleccionado ? '!border-sage-300' : '',
                ].join(' ')}
              >
                <div className="flex items-center justify-between">
                  <span className={[
                    'text-xs sm:text-sm leading-none flex items-center justify-center w-6 h-6 rounded-full',
                    esHoy ? 'bg-sage-600 text-white font-semibold' : c.otroMes ? 'text-stone-300' : 'text-stone-600',
                  ].join(' ')}>
                    {c.dia}
                  </span>
                  {cantidad > 0 && (
                    <span className="text-[10px] font-semibold text-stone-400">{cantidad}</span>
                  )}
                </div>

                {/* Resumen por pedido (desktop) */}
                {cantidad > 0 && (
                  <div className="hidden sm:flex flex-col gap-0.5 mt-1">
                    {lista.slice(0, MAX).map((p) => {
                      const nombre = `${p.shipping.first_name} ${p.shipping.last_name}`.trim()
                        || `${p.billing.first_name} ${p.billing.last_name}`.trim()
                        || `#${p.number}`
                      const pend = p.status === 'processing'
                      return (
                        <span
                          key={p.id}
                          title={`${nombre}${p.meta.horario ? ` · ${p.meta.horario}` : ''}`}
                          className={[
                            'truncate text-[10px] leading-tight px-1 py-0.5 rounded border-l-2',
                            pend
                              ? 'bg-rosa-50 text-rosa-700 border-rosa-400'
                              : 'bg-stone-50 text-stone-500 border-stone-300 line-through decoration-stone-300',
                          ].join(' ')}
                        >
                          {p.meta.horario ? <span className="font-semibold">{p.meta.horario} </span> : null}
                          {nombre}
                        </span>
                      )
                    })}
                    {cantidad > MAX && (
                      <span className="text-[10px] text-stone-400 px-1">+{cantidad - MAX} más</span>
                    )}
                  </div>
                )}

                {/* Móvil: punto/contador compacto */}
                {cantidad > 0 && (
                  <div className="sm:hidden mt-auto flex justify-center pb-0.5">
                    <span className={[
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded-md',
                      lista.some((p) => p.status === 'processing') ? 'bg-rosa-100 text-rosa-700' : 'bg-stone-100 text-stone-500',
                    ].join(' ')}>
                      {cantidad}
                    </span>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-stone-100 text-[11px] text-stone-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rosa-400" /> Pendiente
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-stone-300" /> Completado
          </span>
        </div>
      </div>

      {/* Modal con los pedidos del día seleccionado */}
      {diaSel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setDiaSel(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
              <div className="flex items-center gap-2.5 text-stone-700 min-w-0">
                <CalendarDays className="w-5 h-5 shrink-0 text-sage-600" />
                <div className="min-w-0">
                  <h2 className="text-lg font-serif text-stone-800 capitalize truncate">
                    {diaSel === hoy ? `Hoy · ${formatDiaLargo(diaSel)}` : formatDiaLargo(diaSel)}
                  </h2>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {pedidosDelDia.length} pedido{pedidosDelDia.length !== 1 ? 's' : ''} agendado{pedidosDelDia.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDiaSel(null)}
                className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-4 sm:px-6 py-5 bg-stone-50/60 rounded-b-2xl">
              {pedidosDelDia.length === 0 ? (
                <p className="text-sm text-stone-400 py-8 text-center">No hay pedidos para este día.</p>
              ) : (
                <div className="space-y-4">
                  {pedidosDelDia
                    .slice()
                    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'processing' ? -1 : 1))
                    .map((p) => (
                      <PedidoExpandido key={p.id} pedido={p} repartidores={repartidores} onActualizar={cargar} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
