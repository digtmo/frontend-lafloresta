import { PackageX } from 'lucide-react'

export default function EmptyState({
  title = 'Sin resultados',
  description = 'No hay elementos para mostrar.',
  icon,
}: { title?: string; description?: string; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-stone-400">
      {icon ?? <PackageX className="w-10 h-10" />}
      <p className="font-medium text-stone-600">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  )
}
