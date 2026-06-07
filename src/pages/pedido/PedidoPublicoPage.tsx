import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { WooProduct, WooVariation } from '@/types'
import { formatCLP } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { Loader2, CheckCircle, Clock, AlertTriangle, Plus, Trash2, Check } from 'lucide-react'

const HORARIOS = ['09:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 - 21:00']

type Estado = 'validando' | 'valido' | 'invalido' | 'enviando' | 'expirado' | 'enviado'
type LineItem = { productoId: string; variacionId: string; cantidad: number }

const itemVacio = (): LineItem => ({ productoId: '', variacionId: '', cantidad: 1 })

export default function PedidoPublicoPage() {
  const { token } = useParams<{ token: string }>()

  const [estado,       setEstado]       = useState<Estado>('validando')
  const [expiraEn,     setExpiraEn]     = useState<number>(0)
  const [segundosRest, setSegundosRest] = useState<number>(0)
  const [numeroPedido, setNumeroPedido] = useState('')
  const [productos,    setProductos]    = useState<WooProduct[]>([])

  const [items,       setItems]       = useState<LineItem[]>([itemVacio()])
  const [varPorItem,  setVarPorItem]  = useState<Record<number, WooVariation[]>>({})
  const [cargVarItem, setCargVarItem] = useState<Record<number, boolean>>({})

  const [form, setForm] = useState({
    nombreRemitente:      '',
    telefonoRemitente:    '',
    correoRemitente:      '',
    fechaEnvio:           '',
    horario:              HORARIOS[0],
    nombreReceptor:       '',
    direccionEnvio:       '',
    telefonoDestinatario: '',
    mensajePersonal:      '',
    observaciones:        '',
    tipoEnvio:            'envio' as 'envio' | 'retiro',
  })

  useEffect(() => {
    async function validar() {
      try {
        const data = await apiFetch<{ valido: boolean; expiraEn: number }>(`/api/tokens?token=${token}`)
        if (!data.valido) { setEstado('invalido'); return }
        setExpiraEn(data.expiraEn)
        setEstado('valido')
        const dataProd = await apiFetch<{ productos: WooProduct[] }>('/api/productos')
        setProductos(dataProd.productos ?? [])
      } catch {
        setEstado('invalido')
      }
    }
    validar()
  }, [token])

  useEffect(() => {
    if (estado !== 'valido' || !expiraEn) return
    const tick = () => {
      const restMs = expiraEn - Date.now()
      if (restMs <= 0) { setEstado('expirado'); setSegundosRest(0); return }
      setSegundosRest(Math.ceil(restMs / 1000))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [estado, expiraEn])

  async function cargarVariaciones(idx: number, productoId: string) {
    const prod = productos.find((p) => String(p.id) === productoId)
    if (!prod || prod.type !== 'variable') { setVarPorItem((v) => ({ ...v, [idx]: [] })); return }
    setCargVarItem((c) => ({ ...c, [idx]: true }))
    try {
      const d = await apiFetch<{ variaciones: WooVariation[] }>(`/api/productos/${productoId}/variaciones`)
      setVarPorItem((v) => ({ ...v, [idx]: d.variaciones ?? [] }))
    } catch {
      toast.error('Error al cargar variaciones')
    } finally {
      setCargVarItem((c) => ({ ...c, [idx]: false }))
    }
  }

  function updateItem(idx: number, field: keyof LineItem, value: string | number) {
    setItems((prev) => {
      const next = prev.map((it, i) => i === idx ? { ...it, [field]: value } : it)
      if (field === 'productoId') {
        next[idx].variacionId = ''
        cargarVariaciones(idx, value as string)
      }
      return next
    })
  }

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  const subtotal = items.reduce((acc, it) => {
    const prod   = productos.find((p) => String(p.id) === it.productoId)
    const vars   = varPorItem[items.indexOf(it)] ?? []
    const varSel = vars.find((v) => String(v.id) === it.variacionId)
    const precio = varSel ? parseFloat(varSel.price) : prod ? parseFloat(prod.price) : 0
    return acc + precio * it.cantidad
  }, 0)
  const costoEnvio = form.tipoEnvio === 'envio' ? 4000 : 0
  const total      = subtotal + costoEnvio

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (estado === 'expirado') { toast.error('El formulario ha expirado'); return }
    if (!items[0]?.productoId) { toast.error('Selecciona al menos un producto'); return }
    for (let i = 0; i < items.length; i++) {
      const it   = items[i]
      const prod = productos.find((p) => String(p.id) === it.productoId)
      if (!it.productoId) { toast.error(`Producto ${i + 1}: selecciona un producto`); return }
      if (prod?.type === 'variable' && !it.variacionId) { toast.error(`Producto ${i + 1}: selecciona una variación`); return }
    }
    setEstado('enviando')
    try {
      const data = await apiFetch<{ order: { number: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ ...form, token, lineItems: items }),
      })
      setNumeroPedido(data.order.number)
      setEstado('enviado')
    } catch {
      setEstado('valido')
      toast.error('Error al enviar el pedido. Intenta de nuevo.')
    }
  }

  const mm = String(Math.floor(segundosRest / 60)).padStart(2, '0')
  const ss = String(segundosRest % 60).padStart(2, '0')
  const tiempoRestante       = `${mm}:${ss}`
  const expiradoProximamente = segundosRest <= 60 && segundosRest > 0

  if (estado === 'validando') {
    return <PaginaBase><CenteredBox><Loader2 className="w-8 h-8 animate-spin text-salvia-500 mx-auto" /><p className="text-stone-500 mt-3">Validando enlace…</p></CenteredBox></PaginaBase>
  }

  if (estado === 'invalido') {
    return (
      <PaginaBase>
        <CenteredBox>
          <AlertTriangle className="w-10 h-10 text-terracota-500 mx-auto" />
          <h2 className="text-xl font-serif text-stone-800 mt-3">Enlace inválido</h2>
          <p className="text-stone-500 text-sm mt-2">Este enlace no existe o ya fue utilizado.</p>
        </CenteredBox>
      </PaginaBase>
    )
  }

  if (estado === 'expirado') {
    return (
      <PaginaBase>
        <CenteredBox>
          <Clock className="w-10 h-10 text-yellow-500 mx-auto" />
          <h2 className="text-xl font-serif text-stone-800 mt-3">Tiempo expirado</h2>
          <p className="text-stone-500 text-sm mt-2">El tiempo para completar el formulario ha terminado.<br />Solicita un nuevo enlace al equipo de La Floresta.</p>
        </CenteredBox>
      </PaginaBase>
    )
  }

  if (estado === 'enviado') {
    return (
      <PaginaBase>
        <CenteredBox>
          <CheckCircle className="w-12 h-12 text-salvia-500 mx-auto" />
          <h2 className="text-2xl font-serif text-stone-800 mt-4">¡Pedido enviado!</h2>
          <p className="text-stone-500 text-sm mt-2">Tu pedido <strong>#{numeroPedido}</strong> fue creado con éxito.</p>
          <p className="text-stone-400 text-xs mt-4">El equipo de La Floresta se pondrá en contacto contigo pronto.</p>
        </CenteredBox>
      </PaginaBase>
    )
  }

  const bloqueado = estado === 'enviando'

  return (
    <PaginaBase>
      <div className={`sticky top-0 z-10 flex items-center justify-center gap-2 py-3 text-sm font-medium shadow-sm ${
        expiradoProximamente
          ? 'bg-terracota-600 text-white border-b border-terracota-700'
          : 'bg-salvia-600 text-white border-b border-salvia-700'
      }`}>
        <Clock className="w-4 h-4" />
        Tiempo restante: <span className="font-mono font-bold">{tiempoRestante}</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <img
            src="https://laflorestafloreria.cl/wp-content/uploads/2025/01/cropped-cropped-logo-floresta-1.png"
            alt="La Floresta"
            className="h-20 w-auto object-contain mx-auto mb-2"
          />
          <p className="text-sm text-stone-500">Completa tu pedido</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="card p-5">
            <p className="section-title">Quién envía</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Nombre completo *</label>
                <input className="input" required disabled={bloqueado} value={form.nombreRemitente}
                  onChange={(e) => setField('nombreRemitente', e.target.value)} placeholder="Tu nombre" />
              </div>
              <div>
                <label className="label">Teléfono *</label>
                <input className="input" required type="tel" disabled={bloqueado} value={form.telefonoRemitente}
                  onChange={(e) => setField('telefonoRemitente', e.target.value)} placeholder="+56 9 1234 5678" />
              </div>
              <div>
                <label className="label">Correo *</label>
                <input className="input" required type="email" disabled={bloqueado} value={form.correoRemitente}
                  onChange={(e) => setField('correoRemitente', e.target.value)} placeholder="correo@ejemplo.cl" />
              </div>
              <div>
                <label className="label">Fecha de envío o retiro *</label>
                <input className="input" required type="date" disabled={bloqueado} value={form.fechaEnvio}
                  onChange={(e) => setField('fechaEnvio', e.target.value)} />
              </div>
              <div>
                <label className="label">Horario *</label>
                <select className="input" disabled={bloqueado} value={form.horario}
                  onChange={(e) => setField('horario', e.target.value)}>
                  {HORARIOS.map((h) => <option key={h}>{h}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-title">Tipo de despacho</p>
            <div className="flex gap-3">
              {(['envio', 'retiro'] as const).map((t) => {
                const seleccionado = form.tipoEnvio === t
                return (
                  <label key={t} className={`relative flex-1 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    seleccionado ? 'border-salvia-500 bg-salvia-500 shadow-md' : 'border-stone-200 bg-white hover:border-stone-300'
                  } ${bloqueado ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input type="radio" name="tipoEnvio" value={t} disabled={bloqueado}
                      checked={seleccionado} onChange={() => setField('tipoEnvio', t)} className="sr-only" />
                    {seleccionado && (
                      <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                        <Check className="w-3 h-3 text-salvia-600 stroke-[3]" />
                      </span>
                    )}
                    <p className={`text-sm font-semibold ${seleccionado ? 'text-white' : 'text-stone-800'}`}>
                      {t === 'envio' ? 'Envío a domicilio' : 'Retiro en local'}
                    </p>
                    <p className={`text-xs mt-0.5 ${seleccionado ? 'text-salvia-100' : 'text-stone-400'}`}>
                      {t === 'envio' ? formatCLP(4000) : 'Gratis'}
                    </p>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="card p-5">
            <p className="section-title">Quién recibe</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Nombre del receptor *</label>
                <input className="input" required disabled={bloqueado} value={form.nombreReceptor}
                  onChange={(e) => setField('nombreReceptor', e.target.value)} placeholder="Nombre completo" />
              </div>
              {form.tipoEnvio === 'envio' && (
                <div className="sm:col-span-2">
                  <label className="label">Dirección de envío</label>
                  <input className="input" disabled={bloqueado} value={form.direccionEnvio}
                    onChange={(e) => setField('direccionEnvio', e.target.value)} placeholder="Calle, número, ciudad" />
                </div>
              )}
              <div>
                <label className="label">Teléfono del receptor</label>
                <input className="input" type="tel" disabled={bloqueado} value={form.telefonoDestinatario}
                  onChange={(e) => setField('telefonoDestinatario', e.target.value)} placeholder="+56 9 1234 5678" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Mensaje personal</label>
                <textarea className="input resize-none h-20" disabled={bloqueado} value={form.mensajePersonal}
                  onChange={(e) => setField('mensajePersonal', e.target.value)} placeholder="Mensaje para la tarjeta…" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Observaciones</label>
                <textarea className="input resize-none h-16" disabled={bloqueado} value={form.observaciones}
                  onChange={(e) => setField('observaciones', e.target.value)} placeholder="Instrucciones especiales…" />
              </div>
            </div>
          </div>

          <div className="card p-5">
            <p className="section-title">Productos</p>
            <div className="space-y-5">
              {items.map((item, idx) => {
                const prodSel = productos.find((p) => String(p.id) === item.productoId)
                const vars    = varPorItem[idx] ?? []
                const cargVar = cargVarItem[idx] ?? false

                return (
                  <div key={idx} className={`space-y-3 ${idx > 0 ? 'pt-4 border-t border-stone-100' : ''}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-stone-400 uppercase tracking-wide">
                        Producto {items.length > 1 ? idx + 1 : ''}
                      </span>
                      {idx > 0 && (
                        <button type="button" disabled={bloqueado}
                          onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                          className="text-stone-400 hover:text-red-500 transition-colors disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="label">Producto *</label>
                      <select className="input" required disabled={bloqueado} value={item.productoId}
                        onChange={(e) => updateItem(idx, 'productoId', e.target.value)}>
                        <option value="">— Seleccionar —</option>
                        {productos.map((p) => (
                          <option key={p.id} value={String(p.id)}>
                            {p.name} — {formatCLP(parseFloat(p.price))}
                          </option>
                        ))}
                      </select>
                    </div>

                    {prodSel?.type === 'variable' && (
                      <div>
                        <label className="label">Variación *</label>
                        {cargVar ? (
                          <div className="input flex items-center gap-2 text-stone-400">
                            <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
                          </div>
                        ) : (
                          <select className="input" required disabled={bloqueado} value={item.variacionId}
                            onChange={(e) => updateItem(idx, 'variacionId', e.target.value)}>
                            <option value="">— Seleccionar variación —</option>
                            {vars.map((v) => (
                              <option key={v.id} value={String(v.id)}>
                                {v.attributes.map((a) => `${a.name}: ${a.option}`).join(', ')} — {formatCLP(parseFloat(v.price))}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    <div>
                      <label className="label">Cantidad</label>
                      <input className="input w-24" type="number" min={1} disabled={bloqueado}
                        value={item.cantidad}
                        onChange={(e) => updateItem(idx, 'cantidad', Math.max(1, Number(e.target.value)))} />
                    </div>
                  </div>
                )
              })}

              <button type="button" disabled={bloqueado} onClick={() => setItems((p) => [...p, itemVacio()])}
                className="flex items-center gap-2 text-sm text-salvia-600 hover:text-salvia-700 font-medium disabled:opacity-50 transition-colors mt-1">
                <Plus className="w-4 h-4" />
                Agregar otro producto
              </button>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex justify-between text-sm text-stone-600">
              <span>Subtotal</span><span>{formatCLP(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-stone-600 mt-2">
              <span>{form.tipoEnvio === 'envio' ? 'Envío' : 'Retiro en local'}</span>
              <span>{formatCLP(costoEnvio)}</span>
            </div>
            <div className="flex justify-between font-semibold text-stone-800 mt-3 pt-3 border-t border-stone-100">
              <span>Total</span>
              <span className="text-salvia-700 text-lg">{formatCLP(total)}</span>
            </div>
          </div>

          <button type="submit" className="btn-accent w-full justify-center py-3 text-base" disabled={bloqueado}>
            {bloqueado && <Loader2 className="w-5 h-5 animate-spin" />}
            {bloqueado ? 'Enviando pedido…' : 'Enviar pedido'}
          </button>
        </form>

        <p className="text-center text-xs text-stone-400 mt-8">La Floresta Florería · Los Ángeles, Chile</p>
      </div>
    </PaginaBase>
  )
}

function PaginaBase({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-stone-50">{children}</div>
}

function CenteredBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card p-10 text-center max-w-sm w-full">{children}</div>
    </div>
  )
}
