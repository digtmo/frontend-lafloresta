import type { Pedido } from '@/types'
import { labelEstado } from '@/lib/utils'

// Convierte 'YYYY-MM-DD' en Date local (sin desfase de zona horaria)
function fechaLocal(iso: string | null): Date | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function nombre(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`.trim()
}

const FORMATO_CLP   = '"$"#,##0'
const FORMATO_FECHA = 'dd-mm-yyyy'
const FORMATO_FECHA_HORA = 'dd-mm-yyyy hh:mm'

/**
 * Genera y descarga un .xlsx con los pedidos recibidos.
 * `fechaEntrega` normaliza meta.fechaEnvio (viene en ISO o en texto español según el canal).
 * SheetJS se carga bajo demanda para no inflar el bundle inicial.
 */
export async function exportarPedidosExcel(
  pedidos: Pedido[],
  fechaEntrega: (fechaEnvio: string) => string | null,
  nombreArchivo: string,
): Promise<void> {
  const XLSX = await import('xlsx')

  const filas = pedidos.map((p) => ({
    'N° pedido':         Number(p.number) || p.id,
    'Estado':            labelEstado(p.status),
    'Fecha compra':      p.dateCreated ? new Date(p.dateCreated) : null,
    'Fecha entrega':     fechaLocal(fechaEntrega(p.meta.fechaEnvio)) ?? (p.meta.fechaEnvio || ''),
    'Horario':           p.meta.horario,
    'Cliente':           nombre(p.billing),
    'Email':             p.billing.email,
    'Teléfono cliente':  p.billing.phone,
    'Destinatario':      nombre(p.shipping) || nombre(p.billing),
    'Teléfono destinatario': p.meta.telefonoDestinatario,
    'Dirección':         [p.shipping.address_1, p.shipping.address_2].filter(Boolean).join(', ') || p.billing.address_1,
    'Comuna':            p.shipping.city || p.billing.city,
    'Productos':         p.lineItems.map((i) => `${i.quantity}× ${i.name}`).join('\n'),
    'Subtotal':          p.subtotal,
    'Envío':             p.shippingTotal,
    'Total':             p.total,
    'Método de pago':    p.paymentMethod,
    'Repartidor':        p.repartidorNombre ?? '',
    'Mensaje tarjeta':   p.meta.mensajePersonal,
    'Observaciones':     p.meta.observaciones,
    'Nota del cliente':  p.customerNote,
  }))

  const hoja = XLSX.utils.json_to_sheet(filas, { cellDates: true })
  const columnas = Object.keys(filas[0] ?? {})

  // Formatos de número/fecha por columna
  const rango = XLSX.utils.decode_range(hoja['!ref'] ?? 'A1')
  columnas.forEach((col, c) => {
    const formato =
      ['Subtotal', 'Envío', 'Total'].includes(col) ? FORMATO_CLP
      : col === 'Fecha compra'  ? FORMATO_FECHA_HORA
      : col === 'Fecha entrega' ? FORMATO_FECHA
      : null
    if (!formato) return
    for (let r = 1; r <= rango.e.r; r++) {
      const celda = hoja[XLSX.utils.encode_cell({ r, c })]
      if (celda && (celda.t === 'n' || celda.t === 'd')) celda.z = formato
    }
  })

  // Ancho de columnas según el contenido (con tope para textos largos)
  hoja['!cols'] = columnas.map((col) => {
    const largo = Math.max(
      col.length,
      ...filas.map((f) => {
        const v = f[col as keyof typeof f]
        if (v instanceof Date) return 16
        return String(v ?? '').split('\n').reduce((m, l) => Math.max(m, l.length), 0)
      }),
    )
    return { wch: Math.min(largo + 2, 50) }
  })
  hoja['!autofilter'] = { ref: hoja['!ref'] ?? 'A1' }

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Pedidos')
  XLSX.writeFile(libro, nombreArchivo, { compression: true })
}
