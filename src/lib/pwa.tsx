import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useRegisterSW } from 'virtual:pwa-register/react'

// El evento no está tipado en el DOM estándar.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// Guardamos el evento a nivel de módulo porque el navegador lo dispara una sola
// vez (a veces antes de que monte el componente que lo necesita).
let deferredPrompt: BeforeInstallPromptEvent | null = null

/**
 * Expone si la app se puede instalar (Android/desktop con soporte de
 * `beforeinstallprompt`) y una función para lanzar el diálogo nativo.
 * En iOS este evento no existe: la instalación es manual (Compartir → Agregar
 * a inicio), por eso `canInstall` será false ahí.
 */
export function usePWAInstall() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e as BeforeInstallPromptEvent
      setCanInstall(true)
    }
    const onInstalled = () => {
      deferredPrompt = null
      setCanInstall(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      deferredPrompt = null
      setCanInstall(false)
    }
  }, [])

  return { canInstall, promptInstall }
}

/**
 * Registra el service worker y muestra un toast persistente cuando hay una
 * nueva versión disponible, con un botón para recargar y aplicarla.
 * Se monta una sola vez en la raíz de la app.
 */
export function PWAUpdater() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  useEffect(() => {
    if (!needRefresh) return
    const id = toast(
      (t) => (
        <span className="flex items-center gap-3">
          Nueva versión disponible
          <button
            onClick={() => { toast.dismiss(t.id); updateServiceWorker(true) }}
            className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-medium shrink-0"
          >
            Actualizar
          </button>
        </span>
      ),
      { duration: Infinity, icon: '🔄' },
    )
    return () => toast.dismiss(id)
  }, [needRefresh, updateServiceWorker])

  return null
}
