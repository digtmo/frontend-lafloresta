import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import type { Pedido, WhatsappEstado } from '@/types'
import { formatCLP } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import EstadoBadge from './EstadoBadge'
import {
  Phone, Mail, MapPin, MessageSquare, Package,
  Truck, Loader2, Clock, FileText, CheckCircle2, CreditCard,
  Send, CheckCheck, Eye, XCircle, ImageIcon,
} from 'lucide-react'

interface Props {
  pedido: Pedido
  repartidores: { email: string; nombre: string }[]
  onActualizar: () => void
}

function formatHora(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-CL', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short',
    })
  } catch { return iso }
}

export default function PedidoExpandido({ pedido, repartidores, onActualizar }: Props) {
  const [repEmail,     setRepEmail]     = useState(pedido.repartidorEmail ?? '')
  const [guardando,    setGuardando]    = useState(false)
  const [completando,  setCompletando]  = useState(false)
  const [enviandoWa,   setEnviandoWa]   = useState(false)
  const [fotoAmpliada, setFotoAmpliada] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const remitente = `${pedido.billing.first_name} ${pedido.billing.last_name}`.trim()
  const receptor  = `${pedido.shipping.first_name} ${pedido.shipping.last_name}`.trim()
  const direccion = [pedido.shipping.address_1, pedido.shipping.address_2].filter(Boolean).join(', ')

  async function handleAsignar() {
    if (!repEmail) { toast.error('Selecciona un repartidor'); return }
    setGuardando(true)
    try {
      await apiFetch('/api/asignar', {
        method: 'POST',
        body: JSON.stringify({ pedidoId: pedido.id, repartidorEmail: repEmail }),
      })
      toast.success(`Asignado a ${repartidores.find(r => r.email === repEmail)?.nombre}`)
      onActualizar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al asignar')
    } finally {
      setGuardando(false)
    }
  }

  async function handleCompletar() {
    if (!confirm(`¿Marcar el pedido #${pedido.number} como completado?`)) return
    setCompletando(true)
    try {
      await apiFetch(`/api/entregas/${pedido.id}`, { method: 'POST' })
      toast.success(`Pedido #${pedido.number} completado`)
      onActualizar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al completar')
    } finally {
      setCompletando(false)
    }
  }

  async function handleEnviarWhatsApp(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const telefono = pedido.billing.phone
    if (!telefono) { toast.error('El pedido no tiene teléfono de contacto'); return }

    setEnviandoWa(true)
    try {
      const imagenBase64 = await fileToBase64(file)
      const nombre = remitente || 'Cliente'
      const resp = await apiFetch<{ ok: boolean; pedidoCompletado?: boolean }>('/api/whatsapp-test', {
        method: 'POST',
        body: JSON.stringify({ nombre, telefono, imagenBase64, mimeType: file.type, pedidoId: pedido.id }),
      })
      toast.success(resp.pedidoCompletado
        ? `WhatsApp enviado — pedido #${pedido.number} completado`
        : 'WhatsApp enviado')
      onActualizar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar WhatsApp')
    } finally {
      setEnviandoWa(false)
    }
  }

  const cambiosPendientes = repEmail !== (pedido.repartidorEmail ?? '')
  const wa = pedido.whatsappEnvio
  const fotoEntregaUrl = pedido.fotoEntregaUrl ?? wa?.fotoUrl ?? null

  const metodoPago = pedido.paymentMethod?.toLowerCase()
  const badgePago = metodoPago === 'link'
    ? 'bg-blue-100 text-blue-700'
    : metodoPago === 'admin'
    ? 'bg-stone-100 text-stone-600'
    : 'bg-stone-100 text-stone-500'

  return (
    <>
      <div className="card overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 bg-stone-50/60 border-b border-stone-100 flex-wrap">
          <span className="font-mono font-bold text-black text-sm shrink-0">#{pedido.number}</span>
          <EstadoBadge estado={pedido.status} />
          {pedido.meta.horario && (
            <span className="inline-flex items-center gap-1 text-xs text-stone-500 bg-white border border-stone-200 px-2 py-0.5 rounded-full">
              <Clock className="w-3 h-3" />{pedido.meta.horario}
            </span>
          )}
          {pedido.repartidorNombre && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
              <Truck className="w-3 h-3" />{pedido.repartidorNombre}
            </span>
          )}
          {pedido.paymentMethod && (
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${badgePago}`}>
              <CreditCard className="w-3 h-3" />{pedido.paymentMethod}
            </span>
          )}
          <div className="flex-1" />
          <span className="text-sm font-semibold text-stone-700 shrink-0">{formatCLP(pedido.total)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x divide-stone-100">
          {/* Quien envía */}
          <div className="p-4 space-y-1.5 min-w-0">
            <p className="section-title">Quien envía</p>
            <p className="text-sm font-semibold text-stone-800 truncate">{remitente || '—'}</p>
            {pedido.billing.phone && <InfoFila icon={<Phone className="w-3.5 h-3.5" />} href={`tel:${pedido.billing.phone}`} valor={pedido.billing.phone} />}
            {pedido.billing.email && <InfoFila icon={<Mail className="w-3.5 h-3.5" />} href={`mailto:${pedido.billing.email}`} valor={pedido.billing.email} truncate />}
          </div>

          {/* Quien recibe */}
          <div className="p-4 space-y-1.5 min-w-0">
            <p className="section-title">Quien recibe</p>
            <p className="text-sm font-semibold text-stone-800 truncate">{receptor || '—'}</p>
            {direccion && <InfoFila icon={<MapPin className="w-3.5 h-3.5" />} valor={direccion} />}
            {pedido.meta.telefonoDestinatario && <InfoFila icon={<Phone className="w-3.5 h-3.5" />} href={`tel:${pedido.meta.telefonoDestinatario}`} valor={pedido.meta.telefonoDestinatario} />}
            {pedido.meta.mensajePersonal && <InfoFila icon={<MessageSquare className="w-3.5 h-3.5" />} valor={`"${pedido.meta.mensajePersonal}"`} className="italic text-stone-400" />}
            {(pedido.meta.observaciones || pedido.customerNote) && <InfoFila icon={<FileText className="w-3.5 h-3.5" />} valor={pedido.meta.observaciones || pedido.customerNote} className="text-stone-400" />}
          </div>

          {/* Productos */}
          <div className="p-4 min-w-0">
            <p className="section-title">Productos</p>
            <div className="space-y-1.5">
              {pedido.lineItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <Package className="w-3.5 h-3.5 text-stone-300 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-stone-700 leading-snug line-clamp-2">{item.name}</p>
                      <p className="text-[11px] text-stone-400">× {item.quantity}</p>
                    </div>
                  </div>
                  <p className="text-xs font-semibold text-stone-600 shrink-0">{formatCLP(parseFloat(item.total))}</p>
                </div>
              ))}
            </div>
            <div className="mt-2.5 pt-2 border-t border-stone-100 space-y-0.5">
              {pedido.shippingLines.map((sl, i) => (
                <div key={i} className="flex justify-between text-[11px] text-stone-400">
                  <span>{sl.method_title}</span><span>{formatCLP(parseFloat(sl.total))}</span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-semibold text-stone-700 pt-0.5">
                <span>Total</span><span>{formatCLP(pedido.total)}</span>
              </div>
            </div>
          </div>

          {/* Entrega */}
          <div className="p-4 min-w-0">
            <p className="section-title">Entrega</p>
            {fotoEntregaUrl || wa ? (
              <div className="space-y-3">
                {fotoEntregaUrl ? (
                  <button onClick={() => setFotoAmpliada(true)} className="w-full group relative overflow-hidden rounded-lg border border-stone-200 hover:border-stone-400 transition-colors">
                    <img src={fotoEntregaUrl} alt="Foto entrega" className="w-full max-h-36 object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-80 transition-opacity drop-shadow" />
                    </div>
                  </button>
                ) : (
                  <div className="w-full h-20 rounded-lg border border-dashed border-stone-200 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-stone-300" />
                  </div>
                )}
                {wa && (
                  <div className="space-y-1.5">
                    <div className="flex items-start gap-1.5 flex-wrap">
                      <WhatsappBadge estado={wa.estado} />
                      {wa.respuestaCliente && (
                        <span title={wa.respuestaRecibidaEn ? `Respondió ${formatHora(wa.respuestaRecibidaEn)}` : undefined} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-stone-100 text-stone-700 max-w-full">
                          <MessageSquare className="w-3 h-3 shrink-0" /><span className="truncate">{wa.respuestaCliente}</span>
                        </span>
                      )}
                    </div>
                    <FilaHora icon={<Send className="w-3 h-3" />} label="Enviado" hora={formatHora(wa.enviadoEn)} />
                    {(wa.estado === 'enviado' || wa.estado === 'entregado' || wa.estado === 'leido') && wa.enviadoEn !== wa.actualizadoEn && (
                      <FilaHora icon={<CheckCheck className="w-3 h-3" />} label={wa.estado === 'leido' ? 'Visto' : 'Entregado'} hora={formatHora(wa.actualizadoEn)} />
                    )}
                    {wa.estado === 'error' && <p className="text-[11px] text-red-500">{wa.errorMensaje ?? 'Error desconocido'}</p>}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-stone-300 mt-1">Sin foto de entrega</p>
            )}
          </div>

          {/* Asignación */}
          <div className="p-4 min-w-0">
            <p className="section-title">Asignación</p>
            <div className="space-y-2">
              <select className="input text-xs py-1.5 w-full" value={repEmail} onChange={(e) => setRepEmail(e.target.value)}>
                <option value="">— Sin asignar —</option>
                {repartidores.map((r) => <option key={r.email} value={r.email}>{r.nombre}</option>)}
              </select>
              <button
                onClick={handleAsignar}
                disabled={guardando || !cambiosPendientes}
                className={`w-full justify-center text-xs py-2 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${cambiosPendientes ? 'bg-black text-white hover:bg-stone-800' : 'bg-stone-100 text-stone-400 cursor-not-allowed'}`}
              >
                {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                {guardando ? 'Guardando…' : 'Asignar'}
              </button>
              {pedido.status === 'processing' && (
                <div className="flex flex-wrap gap-1.5">
                  {pedido.billing.phone && (
                    <>
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleEnviarWhatsApp} />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={enviandoWa}
                        className="flex-1 min-w-[6.5rem] whitespace-nowrap justify-center text-xs py-2 rounded-lg font-medium flex items-center gap-1.5 bg-[#25D366] text-white hover:bg-[#1ebe5d] disabled:opacity-60"
                      >
                        {enviandoWa ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="" className="w-3.5 h-3.5" />}
                        {enviandoWa ? 'Enviando…' : 'WhatsApp'}
                      </button>
                    </>
                  )}
                  <button onClick={handleCompletar} disabled={completando} className="flex-1 min-w-[6.5rem] whitespace-nowrap justify-center text-xs py-2 rounded-lg font-medium flex items-center gap-1.5 bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
                    {completando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    {completando ? '…' : 'Completado'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {fotoAmpliada && fotoEntregaUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setFotoAmpliada(false)}>
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img src={fotoEntregaUrl} alt="Foto de entrega" className="rounded-xl object-contain w-full shadow-2xl" />
            <p className="text-center text-white/70 text-xs mt-2">Pedido #{pedido.number} · Toca fuera para cerrar</p>
          </div>
        </div>
      )}
    </>
  )
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function WhatsappBadge({ estado }: { estado: WhatsappEstado }) {
  const cfg: Record<WhatsappEstado, { label: string; icon: React.ReactNode; cls: string }> = {
    enviando:  { label: 'Enviando…', icon: <Send       className="w-3 h-3" />, cls: 'bg-stone-100 text-stone-500' },
    enviado:   { label: 'Enviado',   icon: <Send       className="w-3 h-3" />, cls: 'bg-blue-100 text-blue-600'  },
    entregado: { label: 'Entregado', icon: <CheckCheck className="w-3 h-3" />, cls: 'bg-green-100 text-green-700' },
    leido:     { label: 'Leído',     icon: <Eye        className="w-3 h-3" />, cls: 'bg-salvia-100 text-salvia-700' },
    error:     { label: 'Error',     icon: <XCircle    className="w-3 h-3" />, cls: 'bg-red-100 text-red-600'    },
  }
  const { label, icon, cls } = cfg[estado]
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {icon}{label}
    </span>
  )
}

function FilaHora({ icon, label, hora }: { icon: React.ReactNode; label: string; hora: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
      <span className="text-stone-300 shrink-0">{icon}</span>
      <span className="font-medium text-stone-500">{label}:</span>
      <span>{hora}</span>
    </div>
  )
}

function InfoFila({ icon, valor, href, className = '', truncate = false }: {
  icon: React.ReactNode; valor: string; href?: string; className?: string; truncate?: boolean
}) {
  const textClass = `text-xs text-stone-600 ${truncate ? 'truncate' : 'break-words'} ${className}`
  return (
    <div className="flex items-start gap-1.5">
      <span className="text-stone-300 mt-0.5 shrink-0">{icon}</span>
      {href
        ? <a href={href} className={`${textClass} hover:text-black hover:underline`}>{valor}</a>
        : <span className={textClass}>{valor}</span>}
    </div>
  )
}
