import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { formatCLP, formatFechaCorta, labelEstado, claseEstado } from '@/lib/utils'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { apiFetch } from '@/lib/api'
import {
  ShoppingBag, TrendingUp, DollarSign, RefreshCw, Receipt,
  Truck, Package, MapPin, CreditCard, Calendar, Users, Clock,
  ArrowUp, ArrowDown, Minus, Loader2,
} from 'lucide-react'

const MapaDensidad = lazy(() => import('@/components/admin/MapaDensidad'))

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface Stats {
  rango: { desde: string; hasta: string }
  resumen: {
    totalVentas: number
    totalCompletado: number
    totalCancelado: number
    totalPedidos: number
    ticketPromedio: number
    entregasHoy: number
    entregasMañana: number
  }
  porEstado: Record<string, number>
  ventasPorDia: { fecha: string; total: number; pedidos: number }[]
  topProductos: { nombre: string; cantidad: number; total: number }[]
  topComunas: { nombre: string; count: number }[]
  topMetodosPago: { nombre: string; count: number }[]
  topClientes: { nombre: string; email: string; telefono: string; pedidos: number; total: number }[]
  ventasPorDiaSemana: { nombre: string; total: number; pedidos: number }[]
  pedidosPorHora: { hora: number; count: number }[]
}

interface Marcador {
  lat: number; lng: number; direccion: string; barrio: string | null
  cantidad: number; total: number; ultimaFecha: string
}
interface Sector { barrio: string; cantidad: number; total: number }
interface GeoData {
  marcadores: Marcador[]
  topSectores: Sector[]
  stats: {
    totalPedidos: number; enMapa: number; direccionesUnicas: number
    sinDireccion: number; sinGeo: number; cacheado: number; geocoded: number; pendientes: number
  }
  error?: string
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────
function isoDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDias(base: string, n: number): string {
  const [y, m, d] = base.split('-').map(Number)
  return isoDia(new Date(y, m - 1, d + n))
}

function inicioMes(hoy: string): string {
  const [y, m] = hoy.split('-').map(Number)
  return `${y}-${String(m).padStart(2, '0')}-01`
}

function finMes(hoy: string): string {
  const [y, m] = hoy.split('-').map(Number)
  const ultimo = new Date(y, m, 0).getDate()
  return `${y}-${String(m).padStart(2, '0')}-${String(ultimo).padStart(2, '0')}`
}

type PresetKey = 'hoy' | 'ayer' | '7d' | '30d' | 'mes' | 'mes_pasado' | 'custom'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'hoy',        label: 'Hoy'             },
  { key: 'ayer',       label: 'Ayer'            },
  { key: '7d',         label: 'Últimos 7 días'  },
  { key: '30d',        label: 'Últimos 30 días' },
  { key: 'mes',        label: 'Este mes'        },
  { key: 'mes_pasado', label: 'Mes pasado'      },
]

function rangoPreset(key: PresetKey, custom?: { desde: string; hasta: string }): { desde: string; hasta: string } {
  const hoy = isoDia(new Date())
  switch (key) {
    case 'hoy':         return { desde: hoy, hasta: hoy }
    case 'ayer':       { const ayer = addDias(hoy, -1); return { desde: ayer, hasta: ayer } }
    case '7d':          return { desde: addDias(hoy, -6),  hasta: hoy }
    case '30d':         return { desde: addDias(hoy, -29), hasta: hoy }
    case 'mes':         return { desde: inicioMes(hoy),    hasta: hoy }
    case 'mes_pasado': {
      const [y, m] = hoy.split('-').map(Number)
      const pasado = new Date(y, m - 2, 1)
      const desde = `${pasado.getFullYear()}-${String(pasado.getMonth() + 1).padStart(2, '0')}-01`
      return { desde, hasta: finMes(desde) }
    }
    case 'custom':      return custom ?? { desde: hoy, hasta: hoy }
  }
}

function rangoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const dStart = new Date(`${desde}T00:00:00`)
  const dEnd   = new Date(`${hasta}T00:00:00`)
  const dias   = Math.floor((dEnd.getTime() - dStart.getTime()) / 86_400_000) + 1
  const prevEnd   = new Date(dStart); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - dias + 1)
  return { desde: isoDia(prevStart), hasta: isoDia(prevEnd) }
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [stats,      setStats]      = useState<Stats | null>(null)
  const [statsPrev,  setStatsPrev]  = useState<Stats | null>(null)
  const [geoData,    setGeoData]    = useState<GeoData | null>(null)
  const [loadingGeo, setLoadingGeo] = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [preset,     setPreset]     = useState<PresetKey>('7d')
  const [desde,      setDesde]      = useState(rangoPreset('7d').desde)
  const [hasta,      setHasta]      = useState(rangoPreset('7d').hasta)

  async function cargar(d = desde, h = hasta) {
    setLoading(true)
    try {
      const prev = rangoAnterior(d, h)
      const [dataAct, dataPrev] = await Promise.all([
        apiFetch<Stats>(`/api/stats?desde=${d}&hasta=${h}`),
        apiFetch<Stats>(`/api/stats?desde=${prev.desde}&hasta=${prev.hasta}`).catch(() => null),
      ])
      setStats(dataAct)
      setStatsPrev(dataPrev)
    } catch {
      toast.error('Error al cargar estadísticas')
    } finally {
      setLoading(false)
    }
    cargarMapa(d, h)
  }

  async function cargarMapa(d = desde, h = hasta) {
    setLoadingGeo(true)
    try {
      const data = await apiFetch<GeoData>(`/api/geo/pedidos?desde=${d}&hasta=${h}`)
      setGeoData(data)
    } catch {
      setGeoData({
        marcadores: [], topSectores: [],
        stats: { totalPedidos: 0, enMapa: 0, direccionesUnicas: 0, sinDireccion: 0, sinGeo: 0, cacheado: 0, geocoded: 0, pendientes: 0 },
      })
    } finally {
      setLoadingGeo(false)
    }
  }

  useEffect(() => { cargar() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function aplicarPreset(key: PresetKey) {
    setPreset(key)
    if (key === 'custom') return
    const r = rangoPreset(key)
    setDesde(r.desde)
    setHasta(r.hasta)
    cargar(r.desde, r.hasta)
  }

  function aplicarCustom() {
    if (!desde || !hasta) return
    if (desde > hasta) { toast.error('La fecha de inicio debe ser anterior a la final'); return }
    setPreset('custom')
    cargar(desde, hasta)
  }

  const etiquetaRango = useMemo(() => {
    if (!stats) return ''
    const { desde, hasta } = stats.rango
    if (desde === hasta) return formatFechaCorta(desde)
    return `${formatFechaCorta(desde)} — ${formatFechaCorta(hasta)}`
  }, [stats])

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-start justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-serif text-stone-800">Dashboard</h1>
          <p className="text-sm text-stone-500 mt-0.5 truncate">{etiquetaRango || 'Cargando…'}</p>
        </div>
        <button onClick={() => cargar()} className="btn-outline gap-1.5 shrink-0" title="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      <div className="card p-3 mb-6 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.key} onClick={() => aplicarPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preset === p.key ? 'bg-black text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-stone-100">
          <div className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
            <Calendar className="w-3.5 h-3.5" />
            Personalizado
          </div>
          <div className="flex flex-1 gap-2 items-center">
            <input type="date" className="input flex-1 text-sm" value={desde} max={hasta}
              onChange={(e) => setDesde(e.target.value)} />
            <span className="text-stone-400 text-sm">→</span>
            <input type="date" className="input flex-1 text-sm" value={hasta} min={desde} max={isoDia(new Date())}
              onChange={(e) => setHasta(e.target.value)} />
            <button onClick={aplicarCustom} className="btn-primary text-sm py-1.5">Aplicar</button>
          </div>
        </div>
      </div>

      {loading || !stats ? (
        <LoadingSpinner text="Cargando estadísticas…" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <StatCard label="Ventas del rango"    value={formatCLP(stats.resumen.totalVentas)}
              delta={calcDelta(stats.resumen.totalVentas, statsPrev?.resumen.totalVentas)}
              icon={<DollarSign className="w-5 h-5 text-rosa-500" />} color="bg-rosa-50" />
            <StatCard label="Pedidos"             value={String(stats.resumen.totalPedidos)}
              delta={calcDelta(stats.resumen.totalPedidos, statsPrev?.resumen.totalPedidos)}
              icon={<ShoppingBag className="w-5 h-5 text-sage-600" />} color="bg-sage-50" />
            <StatCard label="Ticket promedio"     value={formatCLP(stats.resumen.ticketPromedio)}
              delta={calcDelta(stats.resumen.ticketPromedio, statsPrev?.resumen.ticketPromedio)}
              icon={<Receipt className="w-5 h-5 text-amber-500" />} color="bg-amber-50" />
            <StatCard label="Ventas completadas"  value={formatCLP(stats.resumen.totalCompletado)}
              delta={calcDelta(stats.resumen.totalCompletado, statsPrev?.resumen.totalCompletado)}
              icon={<TrendingUp className="w-5 h-5 text-green-600" />} color="bg-green-50" />
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <MiniStat label="Entregas hoy"     value={stats.resumen.entregasHoy}    icon={<Truck className="w-4 h-4" />} accent="text-sage-700 bg-sage-50 border-sage-200" />
            <MiniStat label="Entregas mañana"  value={stats.resumen.entregasMañana} icon={<Truck className="w-4 h-4" />} accent="text-rosa-700 bg-rosa-50 border-rosa-200" />
          </div>

          <GraficoVentas data={stats.ventasPorDia} />

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
            <div className="lg:col-span-3">
              <TopProductosDonut productos={stats.topProductos} />
            </div>
            <div className="lg:col-span-2">
              <HoraDiaCard data={stats.pedidosPorHora} />
            </div>
          </div>

          <MapaCard geoData={geoData} loading={loadingGeo} onRefresh={() => cargarMapa()} />

          <div className="mb-6">
            <TopClientesCard clientes={stats.topClientes} ventasTotales={stats.resumen.totalVentas} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <PorEstadoCard porEstado={stats.porEstado} />
            <MetodosPagoCard metodos={stats.topMetodosPago} />
          </div>

          <div className="text-center">
            <Link to="/admin/pedidos" className="text-sm text-stone-600 hover:text-black underline underline-offset-2">
              Ver todos los pedidos →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-componentes ──────────────────────────────────────────────────────────

type Delta = { pct: number; positive: boolean; flat: boolean; sinPrev: boolean }

function calcDelta(actual: number, anterior?: number): Delta | undefined {
  if (anterior === undefined || anterior === null) return undefined
  if (anterior === 0) {
    if (actual === 0) return { pct: 0, positive: false, flat: true, sinPrev: false }
    return { pct: 100, positive: true, flat: false, sinPrev: true }
  }
  const diff = ((actual - anterior) / anterior) * 100
  return { pct: Math.abs(diff), positive: diff > 0, flat: Math.abs(diff) < 0.5, sinPrev: false }
}

function StatCard({ label, value, delta, icon, color }: {
  label: string; value: string; delta?: Delta; icon: React.ReactNode; color: string
}) {
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-stone-400 leading-tight">{label}</p>
        <p className="text-lg font-semibold text-stone-800 mt-0.5 truncate">{value}</p>
        {delta && (
          <div className={`flex items-center gap-0.5 mt-1 text-[11px] font-medium ${
            delta.flat ? 'text-stone-400' : delta.positive ? 'text-green-600' : 'text-red-500'
          }`}>
            {delta.flat ? <Minus className="w-3 h-3" /> : delta.positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            <span>{delta.sinPrev ? 'nuevo' : `${delta.pct.toFixed(0)}%`}</span>
            <span className="text-stone-400 font-normal ml-0.5">vs anterior</span>
          </div>
        )}
      </div>
    </div>
  )
}

function MiniStat({ label, value, icon, accent }: {
  label: string; value: number; icon: React.ReactNode; accent: string
}) {
  return (
    <div className={`card p-3 flex items-center gap-3 border ${accent}`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs leading-tight opacity-80">{label}</p>
        <p className="text-lg font-semibold mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function GraficoVentas({ data }: { data: { fecha: string; total: number; pedidos: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1)
  const totalRango    = data.reduce((s, d) => s + d.total, 0)
  const diasConVentas = data.filter((d) => d.total > 0).length
  const promedio      = diasConVentas > 0 ? totalRango / diasConVentas : 0
  const promedioPct   = max > 0 ? (promedio / max) * 100 : 0

  return (
    <div className="card p-4 sm:p-6 mb-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="font-serif text-stone-800">Ventas por día</h2>
          <p className="text-xs text-stone-400 mt-1">{data.length} día{data.length !== 1 ? 's' : ''} en el rango</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-400">Promedio diario</p>
          <p className="text-sm font-semibold text-stone-700">{formatCLP(promedio)}</p>
        </div>
      </div>
      {data.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-12">Sin datos</p>
      ) : (
        <div className="relative">
          {promedio > 0 && (
            <div className="absolute left-0 right-0 border-t border-dashed border-stone-300 z-0 pointer-events-none"
              style={{ bottom: `${promedioPct}%` }}>
              <span className="absolute -top-4 right-0 text-[10px] text-stone-400 bg-white px-1">prom.</span>
            </div>
          )}
          <div className="flex items-stretch gap-[2px] sm:gap-1 h-48 sm:h-56 relative z-10">
            {data.map((d) => {
              const altura   = max > 0 ? (d.total / max) * 100 : 0
              const hayVenta = d.total > 0
              return (
                <div key={d.fecha} className="flex-1 flex flex-col items-center group min-w-0 h-full">
                  <div className="relative flex-1 w-full flex items-end min-h-0">
                    <div className={`w-full rounded-sm transition-colors ${hayVenta ? 'bg-stone-700 group-hover:bg-sage-500' : 'bg-stone-100'}`}
                      style={{ height: `${Math.max(altura, 1.5)}%` }} />
                    {hayVenta && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-stone-900 text-white text-xs px-2.5 py-1.5 rounded-md whitespace-nowrap z-20 pointer-events-none shadow-lg">
                        <div className="font-semibold">{formatCLP(d.total)}</div>
                        <div className="opacity-70 text-[10px]">{d.pedidos} pedido{d.pedidos !== 1 ? 's' : ''}</div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-stone-400 mt-1.5 truncate w-full text-center">
                    {d.fecha.slice(8, 10)}/{d.fecha.slice(5, 7)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function PorEstadoCard({ porEstado }: { porEstado: Record<string, number> }) {
  const total    = Object.values(porEstado).reduce((s, n) => s + n, 0)
  const entradas = Object.entries(porEstado).sort(([, a], [, b]) => b - a)
  return (
    <div className="card p-4 sm:p-5">
      <h2 className="font-serif text-stone-800 mb-3">Pedidos por estado</h2>
      {entradas.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">Sin datos</p>
      ) : (
        <div className="space-y-2.5">
          {entradas.map(([estado, count]) => {
            const pct = total > 0 ? (count / total) * 100 : 0
            return (
              <div key={estado}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${claseEstado(estado)}`}>{labelEstado(estado)}</span>
                  <span className="text-stone-600 font-medium">{count}</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-stone-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const DONUT_COLORS = ['#5b7556', '#87a181', '#b3c3a6', '#d4a5a5', '#b87979', '#78716c']

function TopProductosDonut({ productos }: { productos: { nombre: string; cantidad: number; total: number }[] }) {
  const total = productos.reduce((s, p) => s + p.total, 0)
  let acc = 0
  const stops = productos.map((p, i) => {
    const start = total > 0 ? (acc / total) * 100 : 0
    acc += p.total
    const end = total > 0 ? (acc / total) * 100 : 0
    return `${DONUT_COLORS[i % DONUT_COLORS.length]} ${start}% ${end}%`
  }).join(', ')

  return (
    <div className="card p-4 sm:p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Package className="w-4 h-4 text-stone-400" />
        <h2 className="font-serif text-stone-800">Mix de productos</h2>
      </div>
      {productos.length === 0 || total === 0 ? (
        <p className="text-sm text-stone-400 text-center py-12">Sin datos</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-36 h-36 sm:w-40 sm:h-40 shrink-0">
            <div className="absolute inset-0 rounded-full transition-all"
              style={{ background: `conic-gradient(${stops})` }} />
            <div className="absolute inset-[18%] rounded-full bg-white flex flex-col items-center justify-center">
              <span className="text-[10px] text-stone-400 uppercase tracking-wider">Total</span>
              <span className="text-sm font-semibold text-stone-800">{formatCLP(total)}</span>
            </div>
          </div>
          <ul className="flex-1 w-full space-y-2 min-w-0">
            {productos.map((p, i) => {
              const pct = (p.total / total) * 100
              return (
                <li key={p.nombre} className="flex items-center gap-2.5 text-sm min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="flex-1 truncate text-stone-700">{p.nombre}</span>
                  <span className="text-xs text-stone-400 shrink-0 tabular-nums">×{p.cantidad}</span>
                  <span className="font-medium text-stone-800 shrink-0 tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

function MapaCard({ geoData, loading, onRefresh }: { geoData: GeoData | null; loading: boolean; onRefresh: () => void }) {
  const pendientes        = geoData?.stats.pendientes ?? 0
  const enMapa            = geoData?.stats.enMapa ?? 0
  const direccionesUnicas = geoData?.stats.direccionesUnicas ?? 0
  const totalUtil         = geoData ? geoData.stats.totalPedidos - geoData.stats.sinDireccion : 0
  const sinGeo            = geoData?.stats.sinGeo ?? 0

  return (
    <div className="card p-4 sm:p-5 mb-6">
      <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
          <h2 className="font-serif text-stone-800 truncate">Entregas en el mapa</h2>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {geoData && enMapa > 0 && (
            <>
              <Stat label="Pedidos" value={`${enMapa} de ${totalUtil}`} />
              <Stat label="Direcciones únicas" value={String(direccionesUnicas)} />
            </>
          )}
          {pendientes > 0 && (
            <button onClick={onRefresh} disabled={loading} className="btn-outline gap-1.5 text-xs py-1.5"
              title={`Faltan ${pendientes} direcciones por geocodificar`}>
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Procesar {Math.min(pendientes, 25)} más
            </button>
          )}
        </div>
      </div>

      {!geoData ? (
        <div className="h-[460px] rounded-lg bg-stone-50 animate-pulse" />
      ) : geoData.error ? (
        <div className="h-[460px] rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
          <div className="text-center px-6 max-w-md">
            <MapPin className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-amber-900">Configuración pendiente</p>
            <p className="text-xs text-amber-700 mt-1.5">{geoData.error}</p>
          </div>
        </div>
      ) : geoData.marcadores.length === 0 && !loading ? (
        <div className="h-[460px] rounded-lg bg-stone-50 flex items-center justify-center">
          <div className="text-center px-6">
            <MapPin className="w-8 h-8 text-stone-300 mx-auto mb-2" />
            <p className="text-sm text-stone-500">Sin direcciones geocodificadas aún</p>
            <p className="text-xs text-stone-400 mt-1">
              {pendientes > 0 ? `${pendientes} pendientes — refresca para procesar` : 'Prueba con un rango más amplio'}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3 relative">
            <Suspense fallback={<div className="h-[420px] rounded-lg bg-stone-50 animate-pulse" />}>
              <MapaDensidad marcadores={geoData.marcadores} />
            </Suspense>
            {loading && (
              <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center z-[800] pointer-events-none">
                <Loader2 className="w-7 h-7 text-sage-600 animate-spin" />
                <p className="text-xs text-stone-600 font-medium mt-2">Actualizando mapa…</p>
              </div>
            )}
          </div>
          <SectoresPanel sectores={geoData.topSectores} totalVentas={geoData.marcadores.reduce((s, m) => s + m.total, 0)} />
        </div>
      )}

      {geoData && (sinGeo > 0 || pendientes > 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] text-stone-400">
          {sinGeo > 0     && <span>· {sinGeo} dirección{sinGeo !== 1 ? 'es' : ''} sin ubicación válida</span>}
          {pendientes > 0 && <span>· {pendientes} pendientes de procesar</span>}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] text-stone-400 uppercase tracking-wide">{label}</p>
      <p className="text-xs font-semibold text-stone-700">{value}</p>
    </div>
  )
}

function SectoresPanel({ sectores, totalVentas }: { sectores: Sector[]; totalVentas: number }) {
  const max = Math.max(...sectores.map((s) => s.cantidad), 1)
  return (
    <div className="lg:col-span-1 bg-stone-50 rounded-lg p-3 sm:p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-3">Top sectores</h3>
      {sectores.length === 0 ? (
        <p className="text-xs text-stone-400">Sin sectores identificados aún</p>
      ) : (
        <ul className="space-y-3">
          {sectores.map((s) => {
            const pct       = (s.cantidad / max) * 100
            const pctVentas = totalVentas > 0 ? (s.total / totalVentas) * 100 : 0
            return (
              <li key={s.barrio}>
                <div className="flex items-baseline justify-between gap-2 mb-1">
                  <span className="text-sm font-medium text-stone-800 truncate">{s.barrio}</span>
                  <span className="text-xs text-stone-500 shrink-0 tabular-nums">{s.cantidad}</span>
                </div>
                <div className="h-1 bg-stone-200 rounded-full overflow-hidden mb-0.5">
                  <div className="h-full bg-sage-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-stone-400 tabular-nums">{formatCLP(s.total)} · {pctVentas.toFixed(0)}%</p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function TopClientesCard({ clientes, ventasTotales }: {
  clientes: { nombre: string; email: string; telefono: string; pedidos: number; total: number }[]
  ventasTotales: number
}) {
  const totalTop      = clientes.reduce((s, c) => s + c.total, 0)
  const concentracion = ventasTotales > 0 ? (totalTop / ventasTotales) * 100 : 0
  const maxCliente    = clientes[0]?.total ?? 1

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-stone-400" />
          <h2 className="font-serif text-stone-800">Mejores clientes</h2>
        </div>
        {clientes.length > 0 && ventasTotales > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Top 5</p>
            <p className="text-xs font-semibold text-stone-700">{concentracion.toFixed(0)}% del total</p>
          </div>
        )}
      </div>
      {clientes.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">Sin datos</p>
      ) : (
        <ul className="space-y-3">
          {clientes.map((c, i) => {
            const pct = maxCliente > 0 ? (c.total / maxCliente) * 100 : 0
            return (
              <li key={`${c.email}-${i}`}>
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-stone-100 text-stone-600 text-xs font-semibold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-800 truncate">{c.nombre}</p>
                    <p className="text-xs text-stone-400 truncate">{c.email || c.telefono || '—'}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-stone-800 tabular-nums">{formatCLP(c.total)}</p>
                    <p className="text-[10px] text-stone-400">{c.pedidos} pedido{c.pedidos !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5 ml-10">
                  <div className="h-full bg-stone-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function HoraDiaCard({ data }: { data: { hora: number; count: number }[] }) {
  const max      = Math.max(...data.map((d) => d.count), 1)
  const total    = data.reduce((s, d) => s + d.count, 0)
  const horaPico = [...data].sort((a, b) => b.count - a.count)[0]

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-stone-400" />
          <h2 className="font-serif text-stone-800">Pedidos por hora del día</h2>
        </div>
        {horaPico && horaPico.count > 0 && (
          <div className="text-right">
            <p className="text-[10px] text-stone-400 uppercase tracking-wide">Hora pico</p>
            <p className="text-xs font-semibold text-stone-700">{String(horaPico.hora).padStart(2, '0')}:00</p>
          </div>
        )}
      </div>
      {total === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">Sin datos</p>
      ) : (
        <div>
          <div className="flex items-stretch gap-[2px] h-36">
            {data.map((d) => {
              const altura  = max > 0 ? (d.count / max) * 100 : 0
              const esPunta = d.count === max && d.count > 0
              return (
                <div key={d.hora} className="flex-1 flex flex-col items-center group min-w-0 h-full">
                  <div className="relative flex-1 w-full flex items-end min-h-0">
                    <div className={`w-full rounded-sm transition-colors ${esPunta ? 'bg-rosa-400' : 'bg-stone-200 group-hover:bg-stone-500'}`}
                      style={{ height: `${Math.max(altura, 2)}%` }} />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-stone-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap z-10 pointer-events-none">
                      <div className="font-semibold">{String(d.hora).padStart(2, '0')}:00</div>
                      <div className="opacity-70 text-[10px]">{d.count} pedido{d.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-stone-400">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>
      )}
    </div>
  )
}

function MetodosPagoCard({ metodos }: { metodos: { nombre: string; count: number }[] }) {
  const total = metodos.reduce((s, m) => s + m.count, 0)
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="w-4 h-4 text-stone-400" />
        <h2 className="font-serif text-stone-800">Métodos de pago</h2>
      </div>
      {metodos.length === 0 ? (
        <p className="text-sm text-stone-400 text-center py-6">Sin datos</p>
      ) : (
        <ul className="space-y-2.5">
          {metodos.map((m) => {
            const pct = total > 0 ? (m.count / total) * 100 : 0
            return (
              <li key={m.nombre}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-stone-700 truncate">{m.nombre}</span>
                  <span className="text-stone-500 font-medium tabular-nums">{m.count} · {pct.toFixed(0)}%</span>
                </div>
                <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-sage-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
