import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, PanelLeft } from 'lucide-react'
import Sidebar from './Sidebar'

export default function AdminShell() {
  const [mobileOpen,       setMobileOpen]       = useState(false)
  const [desktopCollapsed, setDesktopCollapsed] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transition-all duration-200 ease-in-out
          md:relative md:translate-x-0 md:shrink-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          ${desktopCollapsed ? 'md:w-0 md:overflow-hidden' : 'md:w-64'}`}
      >
        <Sidebar onClose={() => setMobileOpen(false)} onCollapse={() => setDesktopCollapsed(true)} />
      </div>

      {desktopCollapsed && (
        <button
          onClick={() => setDesktopCollapsed(false)}
          className="hidden md:flex fixed top-3 left-3 z-[60] items-center justify-center w-9 h-9 rounded-lg bg-white border border-stone-200 shadow-sm text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
          title="Mostrar menú"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 shrink-0">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 rounded-lg text-stone-600 hover:bg-stone-100 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <img
            src="https://laflorestafloreria.cl/wp-content/uploads/2025/01/cropped-cropped-logo-floresta-1.png"
            alt="La Floresta"
            className="h-9 w-auto object-contain"
          />
        </header>

        <main className={`flex-1 min-w-0 overflow-auto transition-[padding] duration-200 ${desktopCollapsed ? 'md:pl-14' : ''}`}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
