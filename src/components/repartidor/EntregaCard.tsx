import { Link } from 'react-router-dom'
import type { Pedido } from '@/types'
import { formatFechaCorta } from '@/lib/utils'
import EstadoBadge from '@/components/admin/EstadoBadge'
import { MapPin, Clock, User, ChevronRight } from 'lucide-react'

export default function EntregaCard({ pedido }: { pedido: Pedido }) {
  const receptor  = `${pedido.shipping.first_name} ${pedido.shipping.last_name}`.trim()
  const direccion = `${pedido.shipping.address_1} ${pedido.shipping.address_2 ?? ''}`.trim()

  return (
    <Link to={`/repartidor/entrega/${pedido.id}`} className="card flex items-start gap-4 p-4 hover:shadow-md transition-shadow group">
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-bold text-salvia-600">#{pedido.number}</span>
          <EstadoBadge estado={pedido.status} />
        </div>
        <div className="flex items-center gap-1.5 text-sm text-stone-700">
          <User className="w-3.5 h-3.5 text-stone-300 shrink-0" />
          <span className="font-medium truncate">{receptor || '—'}</span>
        </div>
        <div className="flex items-start gap-1.5 text-sm text-stone-500">
          <MapPin className="w-3.5 h-3.5 text-stone-300 shrink-0 mt-0.5" />
          <span className="truncate">{direccion || 'Retiro en local'}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-stone-400">
          {pedido.meta.horario && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{pedido.meta.horario}</span>}
          {pedido.meta.fechaEnvio && <span>{formatFechaCorta(pedido.meta.fechaEnvio)}</span>}
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-stone-300 group-hover:text-stone-400 mt-1 shrink-0" />
    </Link>
  )
}
