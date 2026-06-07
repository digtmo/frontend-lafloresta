interface BadgeConfig { label: string; dot: string; bg: string; text: string }

function getConfig(estado: string): BadgeConfig {
  switch (estado) {
    case 'processing': return { label: 'Procesando',      dot: 'bg-blue-500',   bg: 'bg-blue-600',   text: 'text-white' }
    case 'completed':  return { label: 'Completado',      dot: 'bg-green-400',  bg: 'bg-green-600',  text: 'text-white' }
    case 'cancelled':  return { label: 'Cancelado',       dot: 'bg-red-400',    bg: 'bg-red-600',    text: 'text-white' }
    case 'pending':    return { label: 'Pago pendiente',  dot: 'bg-yellow-400', bg: 'bg-yellow-500', text: 'text-white' }
    case 'on-hold':    return { label: 'En espera',       dot: 'bg-stone-400',  bg: 'bg-stone-500',  text: 'text-white' }
    case 'refunded':   return { label: 'Reembolsado',     dot: 'bg-orange-400', bg: 'bg-orange-500', text: 'text-white' }
    default:           return { label: estado,            dot: 'bg-stone-400',  bg: 'bg-stone-500',  text: 'text-white' }
  }
}

export default function EstadoBadge({ estado }: { estado: string }) {
  const { label, dot, bg, text } = getConfig(estado)
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} opacity-90 shrink-0`} />
      {label}
    </span>
  )
}
