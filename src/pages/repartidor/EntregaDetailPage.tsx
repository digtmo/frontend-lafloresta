import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { Pedido } from '@/types'
import { formatFechaCorta } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import EstadoBadge from '@/components/admin/EstadoBadge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import {
  ArrowLeft, MapPin, Phone, Clock, MessageSquare, CheckCircle, Package, User, Mail,
} from 'lucide-react'

export default function EntregaDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [pedido,     setPedido]     = useState<Pedido | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [confirmado, setConfirmado] = useState(false)
  const [enviandoWa, setEnviandoWa] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  async function cargar() {
    setLoading(true)
    try {
      const data = await apiFetch<{ pedido: Pedido }>(`/api/pedidos/${id}`)
      setPedido(data.pedido)
      if (data.pedido.status === 'completed') setConfirmado(true)
    } catch {
      toast.error('No se pudo cargar la entrega')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [id])

  async function handleFotoEntrega(e: React.ChangeEvent<HTMLInputElement>) {
    if (!pedido) return
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    const telefonoRemitente = pedido.billing.phone
    if (!telefonoRemitente) { toast.error('El pedido no tiene teléfono de contacto'); return }

    setEnviandoWa(true)
    try {
      const imagenBase64 = await fileToBase64(file)
      const remitente = `${pedido.billing.first_name} ${pedido.billing.last_name}`.trim()

      await apiFetch('/api/whatsapp-test', {
        method: 'POST',
        body: JSON.stringify({
          nombre: remitente || 'Cliente',
          telefono: telefonoRemitente,
          imagenBase64,
          mimeType: file.type,
          pedidoId: pedido.id,
        }),
      })

      await apiFetch(`/api/entregas/${id}`, { method: 'POST' })

      toast.success('Entrega confirmada y WhatsApp enviado')
      setConfirmado(true)
      cargar()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al procesar')
    } finally {
      setEnviandoWa(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (!pedido) return <div className="text-center py-16 text-stone-500">Entrega no encontrada</div>

  const remitente  = `${pedido.billing.first_name} ${pedido.billing.last_name}`.trim()
  const receptor   = `${pedido.shipping.first_name} ${pedido.shipping.last_name}`.trim()
  const direccion  = `${pedido.shipping.address_1} ${pedido.shipping.address_2 ?? ''}`.trim()
  const telefonoDestinatario = pedido.meta.telefonoDestinatario

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-outline px-2.5 py-2.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-serif text-stone-800">Pedido #{pedido.number}</h1>
          <EstadoBadge estado={pedido.status} />
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <p className="section-title">Quien envía</p>
        <Row icon={<User className="w-4 h-4" />} label="Nombre" value={remitente || '—'} />
        {pedido.billing.phone && (
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-stone-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-stone-400">Teléfono</p>
              <a href={`tel:${pedido.billing.phone}`} className="text-sm font-medium text-salvia-600 hover:underline">
                {pedido.billing.phone}
              </a>
            </div>
          </div>
        )}
        {pedido.billing.email && (
          <Row icon={<Mail className="w-4 h-4" />} label="Email" value={pedido.billing.email} />
        )}
      </div>

      <div className="card p-4 space-y-3">
        <p className="section-title">Quien recibe</p>
        <Row icon={<Package className="w-4 h-4" />} label="Nombre" value={receptor || '—'} />
        {direccion && <Row icon={<MapPin className="w-4 h-4" />} label="Dirección" value={direccion} />}
        {telefonoDestinatario && (
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-stone-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-stone-400">Teléfono</p>
              <a href={`tel:${telefonoDestinatario}`} className="text-sm font-medium text-salvia-600 hover:underline">
                {telefonoDestinatario}
              </a>
            </div>
          </div>
        )}
        {pedido.meta.horario && (
          <Row
            icon={<Clock className="w-4 h-4" />}
            label="Horario"
            value={`${pedido.meta.horario}${pedido.meta.fechaEnvio ? ' · ' + formatFechaCorta(pedido.meta.fechaEnvio) : ''}`}
          />
        )}
        {pedido.meta.mensajePersonal && (
          <Row icon={<MessageSquare className="w-4 h-4" />} label="Mensaje personal" value={pedido.meta.mensajePersonal} />
        )}
      </div>

      <div className="card p-4">
        <p className="section-title">Productos</p>
        <div className="space-y-3">
          {pedido.lineItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3">
              {item.image?.src ? (
                <img
                  src={item.image.src}
                  alt={item.name}
                  className="w-12 h-12 rounded-lg object-cover border border-stone-100 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-stone-100 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-stone-300" />
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-stone-800">{item.name}</p>
                <p className="text-xs text-stone-400">Cantidad: {item.quantity}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmado ? (
        <div className="card p-4 flex items-center gap-3 bg-green-50 border-green-200">
          <CheckCircle className="w-6 h-6 text-green-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-green-800">Entrega confirmada</p>
            {pedido.fotoEntregaUrl && (
              <img
                src={pedido.fotoEntregaUrl}
                alt="Foto de entrega"
                className="rounded-lg mt-2 border border-green-200 w-40"
              />
            )}
          </div>
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFotoEntrega}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={enviandoWa}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-base font-semibold text-white bg-[#25D366] hover:bg-[#1ebe5d] disabled:opacity-60 transition-colors"
          >
            {enviandoWa ? (
              <>
                <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando…
              </>
            ) : (
              <>
                <img src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg" alt="WhatsApp" className="w-5 h-5" />
                Avisar por WhatsApp y confirmar entrega
              </>
            )}
          </button>
        </>
      )}
    </div>
  )
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-stone-300 mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="text-xs text-stone-400">{label}</p>
        <p className="text-sm font-medium text-stone-700">{value}</p>
      </div>
    </div>
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
