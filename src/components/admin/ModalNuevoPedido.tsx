import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { WooProduct, WooVariation } from '@/types'
import { formatCLP } from '@/lib/utils'
import { apiFetch } from '@/lib/api'
import { Loader2, ShoppingBag, X, Plus, Trash2 } from 'lucide-react'

const HORARIOS = ['09:00 - 12:00', '12:00 - 15:00', '15:00 - 18:00', '18:00 - 21:00']

interface LineItem { productoId: string; variacionId: string; cantidad: number }
const LINE_ITEM_VACIO: LineItem = { productoId: '', variacionId: '', cantidad: 1 }

const FORM_INICIAL = {
  nombreRemitente: '', telefonoRemitente: '', correoRemitente: '',
  fechaEnvio: '', horario: HORARIOS[0],
  nombreReceptor: '', direccionEnvio: '', telefonoDestinatario: '',
  mensajePersonal: '', observaciones: '',
  tipoEnvio: 'envio' as 'envio' | 'retiro',
}

export default function ModalNuevoPedido({ onClose, onCreado }: { onClose: () => void; onCreado: () => void }) {
  const [productos,    setProductos]    = useState<WooProduct[]>([])
  const [variaciones,  setVariaciones]  = useState<Record<string, WooVariation[]>>({})
  const [cargandoProd, setCargandoProd] = useState(true)
  const [cargandoVar,  setCargandoVar]  = useState<Record<string, boolean>>({})
  const [enviando,     setEnviando]     = useState(false)
  const [form,         setForm]         = useState(FORM_INICIAL)
  const [items,        setItems]        = useState<LineItem[]>([{ ...LINE_ITEM_VACIO }])

  useEffect(() => {
    apiFetch<{ productos: WooProduct[] }>('/api/productos')
      .then((d) => setProductos(d.productos ?? []))
      .catch(() => toast.error('Error al cargar productos'))
      .finally(() => setCargandoProd(false))
  }, [])

  function setField<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }
  function setItem(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it))
  }

  async function cargarVariaciones(idx: number, productoId: string) {
    const prod = productos.find((p) => String(p.id) === productoId)
    if (!prod || prod.type !== 'variable') return
    setCargandoVar((prev) => ({ ...prev, [idx]: true }))
    try {
      const d = await apiFetch<{ variaciones: WooVariation[] }>(`/api/productos/${productoId}/variaciones`)
      setVariaciones((prev) => ({ ...prev, [productoId]: d.variaciones ?? [] }))
    } catch {
      toast.error('Error al cargar variaciones')
    } finally {
      setCargandoVar((prev) => ({ ...prev, [idx]: false }))
    }
  }

  function handleProductoChange(idx: number, productoId: string) {
    setItem(idx, { productoId, variacionId: '', cantidad: 1 })
    if (productoId) cargarVariaciones(idx, productoId)
  }

  const costoEnvio = form.tipoEnvio === 'envio' ? 4000 : 0
  const subtotal = items.reduce((acc, it) => {
    const prod = productos.find((p) => String(p.id) === it.productoId)
    const vari = variaciones[it.productoId]?.find((v) => String(v.id) === it.variacionId)
    const precio = vari ? parseFloat(vari.price) : prod ? parseFloat(prod.price) : 0
    return acc + precio * it.cantidad
  }, 0)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const itemsValidos = items.filter((it) => it.productoId)
    if (itemsValidos.length === 0) { toast.error('Agrega al menos un producto'); return }
    for (const it of itemsValidos) {
      const prod = productos.find((p) => String(p.id) === it.productoId)
      if (prod?.type === 'variable' && !it.variacionId) {
        toast.error(`Selecciona una variación para "${prod.name}"`); return
      }
    }
    setEnviando(true)
    try {
      const lineItems = itemsValidos.map((it) => ({ productoId: it.productoId, variacionId: it.variacionId || undefined, cantidad: it.cantidad }))
      const data = await apiFetch<{ order: { number: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ ...form, lineItems }),
      })
      toast.success(`Pedido #${data.order.number} creado`)
      onCreado(); onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al crear el pedido')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 shrink-0">
          <div>
            <h2 className="text-xl font-serif text-stone-800">Nuevo pedido</h2>
            <p className="text-xs text-stone-400 mt-0.5">Crear pedido en WooCommerce</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5">
          {cargandoProd ? (
            <div className="flex items-center justify-center py-16 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando productos…
            </div>
          ) : (
            <form id="form-nuevo-pedido" onSubmit={handleSubmit} className="space-y-5">
              <section>
                <p className="section-title mb-3">Quién envía</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Nombre *</label>
                    <input className="input" required value={form.nombreRemitente} onChange={(e) => setField('nombreRemitente', e.target.value)} placeholder="Nombre completo" />
                  </div>
                  <div>
                    <label className="label">Teléfono *</label>
                    <input className="input" required type="tel" value={form.telefonoRemitente} onChange={(e) => setField('telefonoRemitente', e.target.value)} placeholder="+56 9 1234 5678" />
                  </div>
                  <div>
                    <label className="label">Correo *</label>
                    <input className="input" required type="email" value={form.correoRemitente} onChange={(e) => setField('correoRemitente', e.target.value)} placeholder="correo@ejemplo.cl" />
                  </div>
                  <div>
                    <label className="label">Fecha de envío *</label>
                    <input className="input" required type="date" value={form.fechaEnvio} onChange={(e) => setField('fechaEnvio', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Horario *</label>
                    <select className="input" value={form.horario} onChange={(e) => setField('horario', e.target.value)}>
                      {HORARIOS.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </section>

              <section>
                <p className="section-title mb-3">Tipo de despacho</p>
                <div className="flex gap-3">
                  {(['envio', 'retiro'] as const).map((t) => (
                    <label key={t} className={`flex-1 flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${form.tipoEnvio === t ? 'border-stone-800 bg-stone-800 text-white' : 'border-stone-200 hover:border-stone-400 text-stone-700'}`}>
                      <input type="radio" name="tipoEnvio" value={t} checked={form.tipoEnvio === t} onChange={() => setField('tipoEnvio', t)} className="sr-only" />
                      <div>
                        <p className="text-sm font-medium">{t === 'envio' ? 'Envío a domicilio' : 'Retiro en local'}</p>
                        <p className={`text-xs ${form.tipoEnvio === t ? 'text-stone-300' : 'text-stone-400'}`}>{t === 'envio' ? formatCLP(4000) : 'Gratis'}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <p className="section-title mb-3">Quién recibe</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="label">Nombre del receptor *</label>
                    <input className="input" required value={form.nombreReceptor} onChange={(e) => setField('nombreReceptor', e.target.value)} placeholder="Nombre completo" />
                  </div>
                  {form.tipoEnvio === 'envio' && (
                    <div className="sm:col-span-2">
                      <label className="label">Dirección de envío</label>
                      <input className="input" value={form.direccionEnvio} onChange={(e) => setField('direccionEnvio', e.target.value)} placeholder="Calle, número, ciudad" />
                    </div>
                  )}
                  <div>
                    <label className="label">Teléfono del receptor</label>
                    <input className="input" type="tel" value={form.telefonoDestinatario} onChange={(e) => setField('telefonoDestinatario', e.target.value)} placeholder="+56 9 1234 5678" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Mensaje personal</label>
                    <textarea className="input resize-none h-16" value={form.mensajePersonal} onChange={(e) => setField('mensajePersonal', e.target.value)} placeholder="Mensaje que irá en la tarjeta…" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Observaciones</label>
                    <textarea className="input resize-none h-14" value={form.observaciones} onChange={(e) => setField('observaciones', e.target.value)} placeholder="Instrucciones especiales…" />
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <p className="section-title">Productos</p>
                  <button type="button" onClick={() => setItems((p) => [...p, { ...LINE_ITEM_VACIO }])} className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Agregar producto
                  </button>
                </div>
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const prod = productos.find((p) => String(p.id) === item.productoId)
                    const vars = variaciones[item.productoId] ?? []
                    return (
                      <div key={idx} className="border border-stone-200 rounded-xl p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-stone-500">Producto {idx + 1}</p>
                          {items.length > 1 && <button type="button" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="text-stone-300 hover:text-red-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <select className="input text-sm" value={item.productoId} onChange={(e) => handleProductoChange(idx, e.target.value)} required>
                              <option value="">— Seleccionar producto —</option>
                              {productos.map((p) => <option key={p.id} value={String(p.id)}>{p.name} — {formatCLP(parseFloat(p.price))}</option>)}
                            </select>
                          </div>
                          <div>
                            <input className="input text-sm" type="number" min={1} value={item.cantidad} onChange={(e) => setItem(idx, { cantidad: Math.max(1, Number(e.target.value)) })} />
                          </div>
                        </div>
                        {prod?.type === 'variable' && (
                          <div>
                            {cargandoVar[idx] ? (
                              <div className="input flex items-center gap-2 text-stone-400 text-sm"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando variaciones…</div>
                            ) : (
                              <select className="input text-sm" value={item.variacionId} onChange={(e) => setItem(idx, { variacionId: e.target.value })} required>
                                <option value="">— Seleccionar variación —</option>
                                {vars.map((v) => <option key={v.id} value={String(v.id)}>{v.attributes.map((a) => `${a.name}: ${a.option}`).join(', ')} — {formatCLP(parseFloat(v.price))}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="bg-stone-50 rounded-xl p-4">
                <p className="section-title mb-2">Resumen</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between text-stone-500"><span>Subtotal</span><span>{formatCLP(subtotal)}</span></div>
                  <div className="flex justify-between text-stone-500"><span>{form.tipoEnvio === 'envio' ? 'Envío a domicilio' : 'Retiro en local'}</span><span>{formatCLP(costoEnvio)}</span></div>
                  <div className="flex justify-between font-semibold text-stone-800 pt-1.5 border-t border-stone-200"><span>Total</span><span>{formatCLP(subtotal + costoEnvio)}</span></div>
                </div>
              </section>
            </form>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-stone-100 shrink-0">
          <button type="button" onClick={onClose} className="btn-outline">Cancelar</button>
          <button type="submit" form="form-nuevo-pedido" className="btn-primary flex-1 justify-center" disabled={enviando || cargandoProd}>
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            <ShoppingBag className="w-4 h-4" />
            {enviando ? 'Creando…' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
