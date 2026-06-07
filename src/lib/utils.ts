export function formatCLP(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-CL', {
    style: 'currency', currency: 'CLP',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(num)
}

export function formatFecha(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch { return dateStr }
}

export function formatFechaCorta(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return dateStr }
}

export function formatFechaHora(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  try {
    return new Date(dateStr).toLocaleString('es-CL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return dateStr }
}

export function labelEstado(estado: string): string {
  const labels: Record<string, string> = {
    pendiente: 'Pendiente', asignado: 'Asignado', en_camino: 'En camino',
    entregado: 'Entregado', retirado: 'Retirado', cancelado: 'Cancelado',
    pending: 'Pago pendiente', processing: 'Procesando', 'on-hold': 'En espera',
    completed: 'Completado', cancelled: 'Cancelado', refunded: 'Reembolsado', failed: 'Fallido',
  }
  return labels[estado] ?? estado
}

export function claseEstado(estado: string): string {
  const clases: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    asignado: 'bg-blue-100 text-blue-800 border-blue-200',
    en_camino: 'bg-purple-100 text-purple-800 border-purple-200',
    entregado: 'bg-green-100 text-green-800 border-green-200',
    retirado: 'bg-green-100 text-green-800 border-green-200',
    cancelado: 'bg-red-100 text-red-800 border-red-200',
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    'on-hold': 'bg-gray-100 text-gray-800 border-gray-200',
    completed: 'bg-green-100 text-green-800 border-green-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
    refunded: 'bg-orange-100 text-orange-800 border-orange-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
  }
  return clases[estado] ?? 'bg-gray-100 text-gray-800 border-gray-200'
}

export function waLink(telefono: string, mensaje: string): string {
  const num = telefono.replace(/\D/g, '')
  const numConPais = num.startsWith('56') ? num : `56${num}`
  return `https://wa.me/${numConPais}?text=${encodeURIComponent(mensaje)}`
}

export function hoyISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function truncar(str: string, max = 40): string {
  return str.length > max ? str.slice(0, max) + '…' : str
}
