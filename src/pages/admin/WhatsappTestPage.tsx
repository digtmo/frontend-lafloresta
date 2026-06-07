import { useState, useRef } from 'react'
import { apiFetch } from '@/lib/api'
import { MessageSquare, Send, ImageIcon, Loader2, CheckCircle2, XCircle } from 'lucide-react'

export default function WhatsappTestPage() {
  const [nombre,   setNombre]   = useState('')
  const [telefono, setTelefono] = useState('')
  const [preview,  setPreview]  = useState<string | null>(null)
  const [mimeType, setMimeType] = useState('')
  const [b64,      setB64]      = useState('')
  const [loading,  setLoading]  = useState(false)
  const [result,   setResult]   = useState<{ ok: boolean; msg: string } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setMimeType(file.type)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setPreview(dataUrl)
      setB64(dataUrl.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre || !telefono || !b64) return
    setLoading(true)
    setResult(null)
    try {
      const data = await apiFetch<{ ok: boolean; messageId?: string; error?: string; detail?: unknown }>(
        '/api/whatsapp-test',
        { method: 'POST', body: JSON.stringify({ nombre, telefono, imagenBase64: b64, mimeType }) }
      )
      if (data.ok) {
        setResult({ ok: true, msg: `Mensaje enviado correctamente. ID: ${data.messageId ?? '—'}` })
      } else {
        setResult({ ok: false, msg: (data.error ?? 'Error desconocido') })
      }
    } catch (err: unknown) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Error de red al contactar el servidor' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
          <div className="px-6 py-5 border-b border-stone-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-50">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-stone-800">Envío de fotos</h1>
              <p className="text-xs text-stone-400 mt-0.5">TEST — WhatsApp Business API</p>
            </div>
            <span className="ml-auto text-[10px] font-semibold px-2 py-1 rounded-md bg-yellow-100 text-yellow-700 uppercase tracking-wide">
              TEST
            </span>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-5">
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Nombre del destinatario</label>
              <input
                type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} required
                placeholder="Ej: María González"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Número de teléfono</label>
              <input
                type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} required
                placeholder="56912345678"
                className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 bg-stone-50 text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition"
              />
              <p className="text-[11px] text-stone-400 mt-1">Sin +, espacios ni guiones</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1.5">Adjuntar imagen</label>
              {preview ? (
                <div className="relative mb-2 rounded-lg overflow-hidden border border-stone-200 bg-stone-50">
                  <img src={preview} alt="Preview" className="w-full max-h-56 object-contain" />
                  <button
                    type="button"
                    onClick={() => { setPreview(null); setB64(''); setMimeType(''); if (fileRef.current) fileRef.current.value = '' }}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-stone-200 text-stone-400 hover:border-green-400 hover:text-green-500 hover:bg-green-50/50 transition"
                >
                  <ImageIcon className="w-7 h-7" />
                  <span className="text-xs">Seleccionar imagen</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
            </div>

            {result && (
              <div className={`flex items-start gap-2.5 rounded-lg px-3 py-3 text-sm ${
                result.ok ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
              }`}>
                {result.ok
                  ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                  : <XCircle     className="w-4 h-4 mt-0.5 shrink-0" />
                }
                <span className="leading-snug">{result.msg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !nombre || !telefono || !b64}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando…</>
              ) : (
                <><Send className="w-4 h-4" /> Enviar por WhatsApp</>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
