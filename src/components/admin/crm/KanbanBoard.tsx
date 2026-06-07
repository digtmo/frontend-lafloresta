import { useCallback, useEffect, useState } from 'react'
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import KanbanColumn, { type ColDef } from './KanbanColumn'
import ConversacionCard, { type Conversacion } from './ConversacionCard'
import ChatPanel from './ChatPanel'
import { CrmEventsProvider, useCrmEvents, samePhone } from './CrmEventsContext'
import { apiFetch } from '@/lib/api'
import { Bot, RefreshCw, MessageSquarePlus, Power, Wifi, WifiOff } from 'lucide-react'

const COLUMNAS: ColDef[] = [
  { id: 'En conversacion', title: 'En conversación', accent: 'bg-blue-500',    dot: 'bg-blue-400',    headerText: 'text-stone-200', dropActive: 'bg-blue-950/20'   },
  { id: 'Link enviado',    title: 'Link enviado',    accent: 'bg-amber-500',   dot: 'bg-amber-400',   headerText: 'text-stone-200', dropActive: 'bg-amber-950/20'  },
  { id: 'Pagado',          title: 'Pagado',          accent: 'bg-emerald-500', dot: 'bg-emerald-400', headerText: 'text-stone-200', dropActive: 'bg-emerald-950/20'},
  { id: 'En reparto',      title: 'En reparto',      accent: 'bg-violet-500',  dot: 'bg-violet-400',  headerText: 'text-stone-200', dropActive: 'bg-violet-950/20' },
  { id: 'Completado',      title: 'Completado',      accent: 'bg-stone-500',   dot: 'bg-stone-500',   headerText: 'text-stone-400', dropActive: 'bg-stone-800/40'  },
]

export default function KanbanBoard() {
  return <CrmEventsProvider><KanbanBoardInner /></CrmEventsProvider>
}

function KanbanBoardInner() {
  const { sseOk, subscribe }        = useCrmEvents()
  const [convs, setConvs]           = useState<Conversacion[]>([])
  const [selected, setSelected]     = useState<Conversacion | null>(null)
  const [dragging, setDragging]     = useState<Conversacion | null>(null)
  const [cargando, setCargando]     = useState(true)
  const [iniciandoDemo, setDemo]    = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [botActivo, setBotActivo]   = useState(false)
  const [toggling, setToggling]     = useState(false)

  useEffect(() => {
    apiFetch<{ activo?: boolean }>('/api/crm/bot').then((d) => setBotActivo(d.activo ?? false)).catch(() => {})
  }, [])

  const handleToggleBot = useCallback(async () => {
    setToggling(true)
    try {
      const data = await apiFetch<{ activo?: boolean }>('/api/crm/bot', {
        method: 'POST', body: JSON.stringify({ activo: !botActivo }),
      })
      setBotActivo(data.activo ?? !botActivo)
    } catch {}
    setToggling(false)
  }, [botActivo])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    setCargando(true)
    apiFetch<Conversacion[]>('/api/crm/conversaciones')
      .then((data) => setConvs(Array.isArray(data) ? data : []))
      .catch(() => setConvs([]))
      .finally(() => setCargando(false))
  }, [refreshKey])

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    let mounted = true

    const refetch = async () => {
      if (!mounted || document.visibilityState === 'hidden') return
      try {
        const data = await apiFetch<Conversacion[]>('/api/crm/conversaciones')
        if (!mounted || !Array.isArray(data)) return
        setConvs((prev) => {
          const serverPhones = new Set(data.map((c) => c.telefono))
          const localOnly = prev.filter((c) => !serverPhones.has(c.telefono))
          return [...data, ...localOnly]
        })
      } catch {}
    }

    const start = () => { if (!intervalId) intervalId = setInterval(refetch, 8000) }
    const stop  = () => { if (intervalId) { clearInterval(intervalId); intervalId = undefined } }
    const onVisibility = () => { if (document.visibilityState === 'visible') { refetch(); start() } else { stop() } }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', refetch)
    return () => { mounted = false; stop(); document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('focus', refetch) }
  }, [])

  useEffect(() => {
    return subscribe((data) => {
      if (data.role === 'crm_estado') {
        setConvs((prev) => prev.map((c) => samePhone(c.telefono, data.telefono) ? { ...c, estado: data.text ?? c.estado } : c))
        setSelected((prev) => { if (!prev || !samePhone(prev.telefono, data.telefono)) return prev; return { ...prev, estado: data.text ?? prev.estado } })
        return
      }
      if (data.role === 'crm_nueva') { setRefreshKey((k) => k + 1); return }
      const esMensaje = data.role === 'user' || data.role === 'bot' || data.role === 'operator' || data.role === 'bot_image'
      if (!esMensaje || !data.telefono) return

      let preview = ''
      if (data.role === 'bot_image') {
        try { const img = JSON.parse(data.text ?? '{}') as { caption?: string }; preview = img.caption ? `📷 ${img.caption.replace(/\*/g, '')}` : '📷 Imagen' } catch { preview = '📷 Imagen' }
      } else { preview = data.text ?? '' }

      const ts = data.ts ?? Date.now()
      setConvs((prev) => {
        const exists = prev.find((c) => samePhone(c.telefono, data.telefono))
        if (!exists) { setRefreshKey((k) => k + 1); return prev }
        return prev.map((c) => samePhone(c.telefono, data.telefono) ? { ...c, ultimoMensaje: preview || c.ultimoMensaje, timestamp: ts, totalMensajes: c.totalMensajes + (data.role === 'user' ? 1 : 0) } : c)
      })
    })
  }, [subscribe])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDragging(convs.find((c) => c.telefono === String(event.active.id)) ?? null)
  }, [convs])

  const handleDragEnd = useCallback(async ({ active, over }: DragEndEvent) => {
    setDragging(null)
    if (!over) return
    const telefono = String(active.id)
    const nuevoEstado = String(over.id)
    const conv = convs.find((c) => c.telefono === telefono)
    if (!conv || conv.estado === nuevoEstado) return
    setConvs((prev) => prev.map((c) => c.telefono === telefono ? { ...c, estado: nuevoEstado } : c))
    const ok = await apiFetch(`/api/crm/conversaciones/${telefono}`, {
      method: 'PATCH', body: JSON.stringify({ estado: nuevoEstado }),
    }).then(() => true).catch(() => false)
    if (!ok) setConvs((prev) => prev.map((c) => c.telefono === telefono ? { ...c, estado: conv.estado } : c))
  }, [convs])

  const handleEstadoCambiado = useCallback((telefono: string, estado: string) => {
    setConvs((prev) => prev.map((c) => c.telefono === telefono ? { ...c, estado } : c))
    setSelected((prev) => prev?.telefono === telefono ? { ...prev, estado } as Conversacion : prev)
  }, [])

  const handleNuevaDemo = useCallback(async () => {
    setDemo(true)
    try {
      const data = await apiFetch<{ sessionId?: string }>('/api/crm/demo', { method: 'POST' })
      setRefreshKey((k) => k + 1)
      setTimeout(() => {
        setConvs((prev) => { const demo = prev.find((c) => c.telefono === data.sessionId); if (demo) setSelected(demo); return prev })
        if (data.sessionId) setSelected({ telefono: data.sessionId, nombre: data.sessionId, estado: 'En conversacion', ultimoMensaje: '', timestamp: Date.now(), totalMensajes: 0 })
      }, 600)
    } catch {}
    setDemo(false)
  }, [])

  const totalConvs = convs.length

  return (
    <div className="flex h-full bg-stone-950">
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex items-center gap-4 px-6 py-4 border-b border-stone-800 shrink-0">
          <div>
            <h1 className="text-base font-semibold text-stone-100 flex items-center gap-2">
              CRM WhatsApp
              {!cargando && <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-stone-800 text-stone-500 border border-stone-700">{totalConvs} conversación{totalConvs !== 1 ? 'es' : ''}</span>}
            </h1>
            <p className="text-xs text-stone-600 mt-0.5 flex items-center gap-1.5">
              {sseOk ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-red-500" />}
              <span>{sseOk ? 'Tiempo real' : 'Modo respaldo (polling)'} · Arrastra para cambiar estado</span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setRefreshKey((k) => k + 1)} className="p-2 rounded-lg text-stone-600 hover:text-stone-300 hover:bg-stone-800 transition-colors" title="Actualizar">
              <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={handleToggleBot} disabled={toggling} title={botActivo ? 'Bot activo — click para desactivar' : 'Bot inactivo — click para activar'}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 ${botActivo ? 'bg-emerald-900/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/70' : 'bg-stone-800/60 border-stone-700 text-stone-500 hover:text-stone-300 hover:bg-stone-800'}`}>
              <Power className={`w-4 h-4 ${toggling ? 'animate-pulse' : ''}`} />
              Bot {botActivo ? 'ON' : 'OFF'}
            </button>
            <button onClick={handleNuevaDemo} disabled={iniciandoDemo} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-violet-900/50 hover:bg-violet-900/80 text-violet-300 border border-violet-800/50 text-sm font-medium transition-colors disabled:opacity-50">
              {iniciandoDemo ? <Bot className="w-4 h-4 animate-pulse" /> : <MessageSquarePlus className="w-4 h-4" />}
              Chat de prueba
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex gap-4 h-full px-6 py-4 min-w-max">
            {cargando ? (
              <div className="flex items-center justify-center w-full">
                <div className="w-8 h-8 border-2 border-stone-700 border-t-stone-400 rounded-full animate-spin" />
              </div>
            ) : (
              <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {COLUMNAS.map((col) => (
                  <KanbanColumn key={col.id} col={col} convs={convs.filter((c) => c.estado === col.id)} selectedPhone={selected?.telefono ?? null} onSelect={setSelected} />
                ))}
                <DragOverlay dropAnimation={null}>
                  {dragging && (
                    <div className="rotate-2 scale-105">
                      <ConversacionCard conv={dragging} onSelect={() => {}} isSelected={false} accentColor={COLUMNAS.find((c) => c.id === dragging.estado)?.accent ?? 'bg-stone-500'} />
                    </div>
                  )}
                </DragOverlay>
              </DndContext>
            )}
          </div>
        </div>
      </div>

      {selected && (
        <div className="w-[380px] shrink-0 h-full border-l border-stone-800">
          <ChatPanel key={selected.telefono} conv={selected} onClose={() => setSelected(null)} onEstadoCambiado={handleEstadoCambiado} />
        </div>
      )}
    </div>
  )
}
