import { Link } from 'react-router-dom'
import type { Pedido } from '@/types'
import { formatCLP, formatFechaCorta } from '@/lib/utils'
import EstadoBadge from './EstadoBadge'
import { ChevronRight } from 'lucide-react'

export default function PedidoCard({ pedido }: { pedido: Pedido }) {
  const receptor  = pedido.shipping.first_name
    ? `${pedido.shipping.first_name} ${pedido.shipping.last_name}`.trim()
    : '—'
  const remitente = `${pedido.billing.first_name} ${pedido.billing.last_name}`.trim()

  return (
    <Link
      to={`/admin/pedidos/${pedido.id}`}
      className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors group"
    >
      <span className="text-sm font-mono font-semibold text-salvia-600 w-16 shrink-0">#{pedido.number}</span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{remitente}</p>
        <p className="text-xs text-stone-400 truncate">Para: {receptor}</p>
      </div>

      <div className="hidden sm:block text-xs text-stone-500 w-24 text-right shrink-0">
        {pedido.meta.fechaEnvio ? formatFechaCorta(pedido.meta.fechaEnvio) : <span className="text-stone-300">—</span>}
      </div>

      <div className="hidden md:block text-xs text-stone-500 w-28 shrink-0">
        {pedido.meta.horario || <span className="text-stone-300">—</span>}
      </div>

      <div className="shrink-0"><EstadoBadge estado={pedido.status} /></div>

      <div className="text-sm font-semibold text-stone-700 w-20 text-right shrink-0">{formatCLP(pedido.total)}</div>

      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-400 shrink-0" />
    </Link>
  )
}
