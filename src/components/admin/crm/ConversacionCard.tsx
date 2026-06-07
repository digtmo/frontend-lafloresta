import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Bot, MessageCircle } from 'lucide-react'

export interface Conversacion {
  telefono: string; nombre: string; estado: string
  ultimoMensaje: string; timestamp: number; totalMensajes: number
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000)
  if (m < 1) return 'ahora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function initials(nombre: string): string {
  if (nombre.match(/^\d+$/)) return nombre.slice(-2)
  return nombre.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

const isDemo = (t: string) => t.startsWith('demo_')

export default function ConversacionCard({ conv, onSelect, isSelected, accentColor }: {
  conv: Conversacion; onSelect: (conv: Conversacion) => void; isSelected: boolean; accentColor: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: conv.telefono, data: { conv } })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }

  const displayName = isDemo(conv.telefono) ? 'Chat de prueba'
    : conv.nombre === conv.telefono ? `+${conv.telefono}` : conv.nombre
  const phone = isDemo(conv.telefono) ? 'Web · IA' : `+${conv.telefono}`

  return (
    <div ref={setNodeRef} style={style} className={`group relative bg-stone-900 rounded-xl border transition-all duration-150 cursor-pointer ${isSelected ? 'border-stone-500 ring-1 ring-stone-500/50 shadow-lg shadow-black/30' : 'border-stone-800 hover:border-stone-600 hover:shadow-md hover:shadow-black/20'}`}>
      <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${accentColor}`} />
      <div className="px-3 py-3 pl-4" onClick={() => onSelect(conv)}>
        <div className="flex items-start gap-2.5">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isDemo(conv.telefono) ? 'bg-violet-900/60 text-violet-300' : 'bg-stone-700 text-stone-300'}`}>
            {isDemo(conv.telefono) ? <Bot className="w-4 h-4" /> : initials(displayName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-1">
              <span className="text-sm font-semibold text-stone-100 truncate">{displayName}</span>
              <span className="text-[10px] text-stone-600 shrink-0">{timeAgo(conv.timestamp)}</span>
            </div>
            <span className="text-[11px] text-stone-600">{phone}</span>
          </div>
        </div>
        {conv.ultimoMensaje && <p className="mt-2 ml-10 text-xs text-stone-500 line-clamp-2 leading-relaxed">{conv.ultimoMensaje}</p>}
        <div className="mt-2 ml-10 flex items-center gap-1.5">
          <MessageCircle className="w-3 h-3 text-stone-700" />
          <span className="text-[10px] text-stone-700">{conv.totalMensajes}</span>
        </div>
      </div>
      <div {...attributes} {...listeners} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-stone-700 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3.5 h-3.5" />
      </div>
    </div>
  )
}
