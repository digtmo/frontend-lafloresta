import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Link2, Copy, Check, Clock, Plus, ExternalLink } from 'lucide-react'
import { apiFetch } from '@/lib/api'

interface TokenGenerado { token: string; url: string; expiraEn: number }

function Contador({ expiraEn }: { expiraEn: number }) {
  const [seg, setSeg] = useState(() => Math.max(0, Math.ceil((expiraEn - Date.now()) / 1000)))

  useEffect(() => {
    const iv = setInterval(() => {
      const r = Math.max(0, Math.ceil((expiraEn - Date.now()) / 1000))
      setSeg(r)
      if (r === 0) clearInterval(iv)
    }, 1000)
    return () => clearInterval(iv)
  }, [expiraEn])

  const mm  = String(Math.floor(seg / 60)).padStart(2, '0')
  const ss  = String(seg % 60).padStart(2, '0')
  const pct = Math.max(0, (seg / (10 * 60)) * 100)

  if (seg === 0) return <span className="text-xs text-red-500 font-medium">Expirado</span>
  return (
    <span className={`text-xs font-mono font-semibold ${seg <= 60 ? 'text-red-500' : 'text-stone-500'}`}>
      <Clock className="w-3 h-3 inline mr-1 -mt-0.5" />{mm}:{ss}
      <span className="text-stone-300 font-normal ml-1">({Math.round(pct)}%)</span>
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    await navigator.clipboard.writeText(text)
    setCopiado(true)
    toast.success('Link copiado al portapapeles')
    setTimeout(() => setCopiado(false), 2000)
  }
  return (
    <button onClick={copiar} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors">
      {copiado ? <><Check className="w-3.5 h-3.5 text-green-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
    </button>
  )
}

export default function TokensPage() {
  const [tokens,    setTokens]    = useState<TokenGenerado[]>([])
  const [generando, setGenerando] = useState(false)

  async function generar() {
    setGenerando(true)
    try {
      const data = await apiFetch<{ token: string; url: string; expiraEn: number }>('/api/tokens', { method: 'POST' })
      setTokens((prev) => [{ token: data.token, url: data.url, expiraEn: data.expiraEn }, ...prev])
      toast.success('Link generado — válido por 30 minutos')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Error al generar el link')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-serif text-stone-800">Links de pedido</h1>
        <p className="text-sm text-stone-500 mt-1">Genera un link único con tiempo limitado (30 min) para que un cliente llene su pedido directamente.</p>
      </div>

      <button onClick={generar} disabled={generando} className="btn-primary mb-8">
        {generando ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Plus className="w-4 h-4" />}
        {generando ? 'Generando…' : 'Generar nuevo link'}
      </button>

      {tokens.length === 0 ? (
        <div className="card p-10 flex flex-col items-center gap-3 text-stone-400">
          <Link2 className="w-8 h-8" />
          <p className="text-sm">Aún no has generado ningún link en esta sesión.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tokens.map((t) => (
            <div key={t.token} className="card p-4 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-stone-400 mb-1 uppercase tracking-wide font-medium">Link del formulario</p>
                  <p className="text-sm font-mono text-salvia-700 break-all leading-snug">{t.url}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <CopyButton text={t.url} />
                <a href={t.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors">
                  <ExternalLink className="w-3.5 h-3.5" /> Abrir
                </a>
                <div className="flex-1" />
                <Contador expiraEn={t.expiraEn} />
              </div>
              <p className="text-[11px] text-stone-300 font-mono break-all">token: {t.token}</p>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-stone-400 mt-6">Los links son de un solo uso y expiran en 30 minutos.</p>
    </div>
  )
}
