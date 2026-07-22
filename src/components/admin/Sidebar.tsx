import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, Truck, LogOut, Link2, MessageSquare, X, PanelLeftClose, Download } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { usePWAInstall } from '@/lib/pwa'

interface Props {
  onClose?:    () => void
  onCollapse?: () => void
}

const NAV = [
  { href: '/admin/dashboard',    label: 'Dashboard',      icon: LayoutDashboard },
  { href: '/admin/pedidos',      label: 'Pedidos',         icon: ShoppingBag    },
  { href: '/admin/repartidores', label: 'Repartidores',    icon: Truck          },
  { href: '/admin/tokens',       label: 'Links de pedido', icon: Link2          },
  { href: '/admin/crm',          label: 'CRM WhatsApp',    icon: MessageSquare  },
]

export default function Sidebar({ onClose, onCollapse }: Props) {
  const location = useLocation()
  const navigate = useNavigate()
  const { logout } = useAuth()
  const { canInstall, promptInstall } = usePWAInstall()

  function handleLogout() {
    logout()
    toast.success('Sesión cerrada')
    navigate('/auth/login')
  }

  return (
    <aside className="w-64 h-screen flex flex-col bg-stone-950 text-stone-100 overflow-hidden">
      <div className="relative flex items-center justify-center px-5 py-5 border-b border-stone-800 shrink-0">
        <img
          src="https://laflorestafloreria.cl/wp-content/uploads/2025/01/cropped-cropped-logo-floresta-1.png"
          alt="La Floresta"
          className="h-20 w-auto object-contain [filter:invert(1)_hue-rotate(180deg)]"
        />
        {onClose && (
          <button onClick={onClose} className="md:hidden absolute right-3 p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
        {onCollapse && (
          <button onClick={onCollapse} className="hidden md:flex absolute right-3 items-center justify-center w-8 h-8 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors" title="Ocultar menú">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin/dashboard'
            ? location.pathname === href
            : location.pathname.startsWith(href)
          return (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active ? 'bg-sage-300/15 text-sage-300' : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-sage-300' : 'text-stone-500'}`} />
              <span className="flex-1">{label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="px-3 py-4 border-t border-stone-800 shrink-0 space-y-0.5">
        {canInstall && (
          <button
            onClick={promptInstall}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sage-300 hover:bg-sage-300/10 transition-colors"
          >
            <Download className="w-4 h-4 shrink-0" />
            Instalar app
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-stone-400 hover:bg-red-950 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
