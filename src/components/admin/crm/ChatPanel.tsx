import { useEffect, useRef, useState, useCallback } from 'react'
import { X, Send, Bot, User, Loader2, Wifi, WifiOff, ImageIcon, Clock } from 'lucide-react'
import type { Conversacion } from './ConversacionCard'
import { useCrmEvents, samePhone, type CrmEvent } from './CrmEventsContext'
import { apiFetch } from '@/lib/api'

const ESTADOS = ['En conversacion', 'Link enviado', 'Pagado', 'En reparto', 'Completado']
const ESTADO_STYLES: Record<string, string> = {
  'En conversacion': 'bg-blue-500/15 text-blue-300 border-blue-700/50',
  'Link enviado':    'bg-amber-500/15 text-amber-300 border-amber-700/50',
  'Pagado':          'bg-emerald-500/15 text-emerald-300 border-emerald-700/50',
  'En reparto':      'bg-violet-500/15 text-violet-300 border-violet-700/50',
  'Completado':      'bg-stone-600/30 text-stone-400 border-stone-600/50',
}

type EventRole = 'user' | 'assistant'
interface ChatEvent {
  type: 'text' | 'image'; role: EventRole
  content?: string; imageUrl?: string; caption?: string
  ts: number; id?: string; clientId?: string; pending?: boolean
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
}

function newClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `c_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function BubbleText({ event, accentClass }: { event: ChatEvent; accentClass: string }) {
  const isUser = event.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? '' : 'flex-row-reverse'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-stone-800' : accentClass}`}>
        {isUser ? <User className="w-3 h-3 text-stone-400" /> : <Bot className="w-3 h-3 text-white/70" />}
      </div>
      <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words ${isUser ? 'bg-stone-800 text-stone-100 rounded-tl-sm' : 'bg-stone-800/60 text-stone-100 rounded-tr-sm border border-stone-700/50'} ${event.pending ? 'opacity-70' : ''}`}>
        {event.content}
        <div className="text-[10px] mt-1.5 text-stone-600 flex items-center gap-1 justify-end">
          {event.pending && <Clock className="w-2.5 h-2.5" />}
          {formatTime(event.ts)}
        </div>
      </div>
    </div>
  )
}

function BubbleImage({ event, accentClass }: { event: ChatEvent; accentClass: string }) {
  const [imgError, setImgError] = useState(false)
  const isUser = event.role === 'user'
  return (
    <div className={`flex gap-2.5 ${isUser ? '' : 'flex-row-reverse'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? 'bg-stone-800' : accentClass}`}>
        {isUser ? <User className="w-3 h-3 text-stone-400" /> : <Bot className="w-3 h-3 text-white/70" />}
      </div>
      <div className={`max-w-[78%] rounded-2xl overflow-hidden border border-stone-700/50 bg-stone-800/60 ${isUser ? 'rounded-tl-sm' : 'rounded-tr-sm'}`}>
        {imgError || !event.imageUrl ? (
          <div className="flex items-center gap-2 px-4 py-3 text-stone-500 text-sm"><ImageIcon className="w-4 h-4" /><span>Imagen no disponible</span></div>
        ) : (
          <img src={event.imageUrl} alt={event.caption || 'Producto'} className="w-56 h-56 object-cover" onError={() => setImgError(true)} />
        )}
        {event.caption && (
          <div className="px-3 py-2 text-xs text-stone-300 whitespace-pre-wrap border-t border-stone-700/50">
            {event.caption.replace(/\*/g, '')}
            <div className="text-[10px] mt-1 text-stone-600">{formatTime(event.ts)}</div>
          </div>
        )}
      </div>
    </div>
  )
}

const isDemo = (t: string) => t.startsWith('demo_')

export default function ChatPanel({ conv, onClose, onEstadoCambiado }: {
  conv: Conversacion; onClose: () => void; onEstadoCambiado: (telefono: string, estado: string) => void
}) {
  const { sseOk, subscribe }    = useCrmEvents()
  const [events, setEvents]     = useState<ChatEvent[]>([])
  const [estado, setEstado]     = useState(conv.estado)
  const [texto, setTexto]       = useState('')
  const [enviando, setEnviando] = useState(false)
  const [manual, setManual]     = useState(false)
  const [cargando, setCargando] = useState(true)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const loadIdRef               = useRef(0)
  const demo                    = isDemo(conv.telefono)
  const accentClass             = demo ? 'bg-violet-700/70' : 'bg-emerald-900/60'
  const displayName             = demo ? 'Chat de prueba' : conv.nombre === conv.telefono ? `+${conv.telefono}` : conv.nombre

  useEffect(() => {
    const myLoadId = ++loadIdRef.current
    setCargando(true); setEvents([])
    apiFetch<Record<string, unknown>>(`/api/crm/conversaciones/${conv.telefono}`)
      .then((data) => {
        if (myLoadId !== loadIdRef.current) return
        const raw = (data.events ?? data.messages ?? []) as ChatEvent[]
        const normalized: ChatEvent[] = raw.map((e) => ({
          type: e.type ?? 'text', role: (e.role === 'user' ? 'user' : 'assistant') as EventRole,
          content: e.content, imageUrl: e.imageUrl, caption: e.caption,
          ts: e.ts ?? Date.now(), id: e.id,
        }))
        setEvents((prev) => mergeEvents(normalized, prev))
        if (typeof data.manual === 'boolean') setManual(data.manual as boolean)
        if (data.estado) setEstado(data.estado as string)
      })
      .catch(() => {})
      .finally(() => { if (myLoadId === loadIdRef.current) { setCargando(false); setTimeout(() => inputRef.current?.focus(), 100) } })
  }, [conv.telefono])

  useEffect(() => {
    if (demo) return
    return subscribe((data: CrmEvent) => {
      if (!data || !samePhone(data.telefono, conv.telefono)) return
      if (data.role === 'crm_estado') {
        if (data.text) { setEstado(data.text); onEstadoCambiado(conv.telefono, data.text) }
        return
      }
      const incoming = crmEventToChatEvent(data)
      if (!incoming) return
      setEvents((prev) => appendOrReconcile(prev, incoming))
    })
  }, [conv.telefono, demo, subscribe, onEstadoCambiado])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [events])

  const handleEstado = useCallback(async (nuevoEstado: string) => {
    setEstado(nuevoEstado); onEstadoCambiado(conv.telefono, nuevoEstado)
    await apiFetch(`/api/crm/conversaciones/${conv.telefono}`, {
      method: 'PATCH', body: JSON.stringify({ estado: nuevoEstado }),
    }).catch(() => {})
  }, [conv.telefono, onEstadoCambiado])

  const handleToggleManual = useCallback(async () => {
    const next = !manual; setManual(next)
    await apiFetch('/api/crm/control', {
      method: 'POST', body: JSON.stringify({ telefono: conv.telefono, manual: next }),
    }).catch(() => setManual(!next))
  }, [manual, conv.telefono])

  const handleEnviar = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    const msg = texto.trim()
    if (!msg || enviando) return
    setTexto(''); setEnviando(true)

    if (demo) {
      setEvents((prev) => [...prev, { type: 'text', role: 'user', content: msg, ts: Date.now() }])
      try {
        const data = await apiFetch<{ eventos?: { type: string; content?: string; imageUrl?: string; caption?: string }[] }>('/api/crm/chat', {
          method: 'POST', body: JSON.stringify({ sessionId: conv.telefono, mensaje: msg }),
        })
        const nuevos: ChatEvent[] = (data.eventos ?? []).map((ev) => ({
          type: ev.type === 'image' ? 'image' : 'text', role: 'assistant' as EventRole,
          content: ev.content, imageUrl: ev.imageUrl, caption: ev.caption, ts: Date.now(),
        }))
        setEvents((prev) => [...prev, ...nuevos])
      } catch {
        setEvents((prev) => [...prev, { type: 'text', role: 'assistant', content: 'Error de conexión con el bot.', ts: Date.now() }])
      }
    } else {
      const clientId = newClientId()
      setEvents((prev) => [...prev, { type: 'text', role: 'assistant', content: msg, ts: Date.now(), clientId, pending: true }])
      try {
        await apiFetch('/api/crm/enviar', { method: 'POST', body: JSON.stringify({ telefono: conv.telefono, texto: msg, clientId }) })
        setEvents((prev) => prev.map((e) => e.clientId === clientId ? { ...e, pending: false } : e))
      } catch {
        setEvents((prev) => prev.map((e) => e.clientId === clientId ? { ...e, pending: false, content: `${e.content ?? ''}  ⚠ no enviado` } : e))
      }
    }

    setEnviando(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [texto, enviando, demo, conv.telefono])

  return (
    <div className="flex flex-col h-full bg-stone-950 border-l border-stone-800">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-stone-800 shrink-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${demo ? 'bg-violet-900/60 text-violet-300' : 'bg-stone-800 text-stone-300'}`}>
          {demo ? <Bot className="w-5 h-5" /> : displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-stone-100 truncate">{displayName}</p>
            {demo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/50 text-violet-400 border border-violet-800/50 font-medium">IA</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {!demo && (sseOk ? <Wifi className="w-2.5 h-2.5 text-emerald-500" /> : <WifiOff className="w-2.5 h-2.5 text-red-500" />)}
            <p className="text-xs text-stone-600">{demo ? 'Asistente virtual · Rosa' : `+${conv.telefono}`}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-stone-600 hover:text-stone-300 hover:bg-stone-800 transition-colors"><X className="w-4 h-4" /></button>
      </div>

      <div className="px-4 py-2.5 border-b border-stone-800/60 flex flex-wrap gap-1.5 shrink-0">
        {ESTADOS.map((e) => (
          <button key={e} onClick={() => handleEstado(e)} className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${estado === e ? ESTADO_STYLES[e] : 'border-stone-800 text-stone-600 hover:text-stone-400 hover:border-stone-700'}`}>
            {e}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
        {cargando && <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 text-stone-600 animate-spin" /></div>}
        {!cargando && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-stone-700 gap-3">
            <Bot className="w-10 h-10" />
            <p className="text-sm font-medium">Sin mensajes</p>
            <p className="text-xs text-center max-w-[200px]">{demo ? 'Escribe para conversar con Rosa' : 'Los mensajes de WhatsApp aparecerán aquí'}</p>
          </div>
        )}
        {events.map((ev, i) => {
          const key = ev.clientId ?? ev.id ?? `${ev.ts}-${ev.role}-${i}`
          return ev.type === 'image'
            ? <BubbleImage key={key} event={ev} accentClass={accentClass} />
            : <BubbleText  key={key} event={ev} accentClass={accentClass} />
        })}
        {enviando && demo && (
          <div className="flex gap-2.5 flex-row-reverse">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${accentClass}`}><Bot className="w-3 h-3 text-white/70" /></div>
            <div className="rounded-2xl rounded-tr-sm px-4 py-3 border bg-stone-800/60 border-stone-700/50">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3.5 border-t border-stone-800 space-y-3 shrink-0">
        {!demo && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-stone-600">Modo operador manual</span>
            <button onClick={handleToggleManual} className={`relative w-10 h-5 rounded-full transition-colors ${manual ? 'bg-amber-600' : 'bg-stone-800'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${manual ? 'left-5' : 'left-0.5'}`} />
            </button>
          </div>
        )}
        <form onSubmit={handleEnviar} className="flex gap-2">
          <input ref={inputRef} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={demo ? 'Escribe a Rosa…' : 'Mensaje como operador…'} disabled={enviando}
            className="flex-1 bg-stone-900 border border-stone-700 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-700 focus:outline-none focus:border-stone-500 disabled:opacity-50 transition-colors" />
          <button type="submit" disabled={!texto.trim() || enviando} className={`p-2.5 rounded-xl transition-colors text-white ${demo ? 'bg-violet-700 hover:bg-violet-600 disabled:bg-stone-800 disabled:text-stone-700' : 'bg-stone-700 hover:bg-stone-600 disabled:bg-stone-800 disabled:text-stone-700'}`}>
            {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  )
}

function crmEventToChatEvent(data: CrmEvent): ChatEvent | null {
  const ts = data.ts ?? Date.now()
  if (data.role === 'bot_image') {
    let img: { imageUrl?: string; caption?: string } = {}
    try { img = JSON.parse(data.text ?? '{}') } catch { return null }
    if (!img.imageUrl) return null
    return { type: 'image', role: 'assistant', imageUrl: img.imageUrl, caption: img.caption, ts, id: data.id }
  }
  if (data.role === 'user' || data.role === 'bot' || data.role === 'operator') {
    return { type: 'text', role: data.role === 'user' ? 'user' : 'assistant', content: data.text, ts, id: data.id }
  }
  return null
}

function appendOrReconcile(prev: ChatEvent[], incoming: ChatEvent): ChatEvent[] {
  if (incoming.id && prev.some((e) => e.id === incoming.id)) return prev
  if (incoming.role === 'assistant' && incoming.type === 'text') {
    const idx = prev.findIndex((e) => e.clientId && e.type === 'text' && e.role === 'assistant' && e.content === incoming.content && Math.abs(e.ts - incoming.ts) < 30_000)
    if (idx >= 0) {
      const next = prev.slice()
      next[idx] = { ...prev[idx], ts: incoming.ts, id: incoming.id, pending: false }
      return next
    }
  }
  return [...prev, incoming]
}

function mergeEvents(history: ChatEvent[], buffered: ChatEvent[]): ChatEvent[] {
  if (buffered.length === 0) return history
  const seenIds = new Set(history.filter((e) => e.id).map((e) => e.id!))
  const extra = buffered.filter((e) => !e.id || !seenIds.has(e.id))
  return [...history, ...extra].sort((a, b) => a.ts - b.ts)
}
