import { Loader2 } from 'lucide-react'

export default function LoadingSpinner({ text = 'Cargando…', size = 'md' }: { text?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' }
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Loader2 className={`${sizes[size]} text-salvia-500 animate-spin`} />
      {text && <p className="text-sm text-stone-500">{text}</p>}
    </div>
  )
}
