import { useDroppable } from '@dnd-kit/core'
import ConversacionCard, { type Conversacion } from './ConversacionCard'

interface ColDef {
  id: string; title: string; accent: string; dot: string; headerText: string; dropActive: string
}

interface Props {
  col: ColDef; convs: Conversacion[]; selectedPhone: string | null; onSelect: (conv: Conversacion) => void
}

export type { ColDef }

export default function KanbanColumn({ col, convs, selectedPhone, onSelect }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: col.id })

  return (
    <div className="flex flex-col w-72 shrink-0 h-full">
      <div className="flex items-center gap-2.5 px-3 py-2.5 mb-2">
        <div className={`w-2 h-2 rounded-full ${col.dot}`} />
        <span className={`text-sm font-semibold ${col.headerText}`}>{col.title}</span>
        <span className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-stone-800 text-stone-500 border border-stone-700">{convs.length}</span>
      </div>
      <div ref={setNodeRef} className={`flex-1 rounded-2xl p-2 space-y-2 transition-colors duration-150 min-h-[200px] border border-dashed ${isOver ? `${col.dropActive} border-stone-600` : 'bg-stone-900/40 border-stone-800/60'}`}>
        {convs.map((conv) => (
          <ConversacionCard key={conv.telefono} conv={conv} onSelect={onSelect} isSelected={selectedPhone === conv.telefono} accentColor={col.accent} />
        ))}
        {convs.length === 0 && (
          <div className="flex items-center justify-center h-20">
            <span className="text-xs text-stone-700 select-none">Arrastra aquí</span>
          </div>
        )}
      </div>
    </div>
  )
}
