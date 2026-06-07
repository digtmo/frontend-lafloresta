import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import type { Pedido } from '@/types'
import EntregaCard from '@/components/repartidor/EntregaCard'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { apiFetch } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { RefreshCw, Truck } from 'lucide-react'

export default function RepartidorDashboardPage() {
  const { user } = useAuth()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)

  async function cargar() {
    setLoading(true)
    try {
      const data = await apiFetch<{ pedidos: Pedido[] }>('/api/mis-entregas')
      setPedidos(data.pedidos)
    } catch {
      toast.error('Error al cargar entregas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { cargar() }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-serif text-stone-800">
            {user?.nombre ? `Hola, ${user.nombre}` : 'Mis entregas'}
          </h1>
          <p className="text-sm text-stone-500 mt-0.5">
            {pedidos.length} entrega{pedidos.length !== 1 ? 's' : ''} asignada{pedidos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={cargar} className="btn-outline">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : pedidos.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-10 h-10 text-stone-300" />}
          title="Sin entregas asignadas"
          description="El administrador te asignará entregas en breve."
        />
      ) : (
        <div className="space-y-3">
          {pedidos.map((p) => <EntregaCard key={p.id} pedido={p} />)}
        </div>
      )}
    </div>
  )
}
