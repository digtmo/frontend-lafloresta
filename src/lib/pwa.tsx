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

const esIOS = (): boolean =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPad con iPadOS se identifica como Mac pero es táctil
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

const yaInstalada = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true

/**
 * Expone si la app se puede instalar y una acción para instalarla:
 * - Android/desktop (Chrome, Edge…): dispara el diálogo nativo vía
 *   `beforeinstallprompt`.
 * - iOS (Safari): ese evento no existe, así que mostramos las instrucciones
 *   manuales (Compartir → Agregar a inicio).
 * `instalable` es false si la app ya está instalada (modo standalone).
 */
export function usePWAInstall() {
  const [canPrompt, setCanPrompt] = useState(!!deferredPrompt)
  const [ios] = useState(() => esIOS() && !yaInstalada())

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferredPrompt = e as BeforeInstallPromptEvent
      setCanPrompt(true)
    }
    const onInstalled = () => {
      deferredPrompt = null
      setCanPrompt(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        deferredPrompt = null
        setCanPrompt(false)
      }
      return
    }
    if (ios) {
      toast(
        'Para instalar: toca el botón Compartir y luego “Agregar a inicio”.',
        { icon: '📲', duration: 6000 },
      )
    }
  }, [ios])

  return { canInstall: canPrompt || ios, promptInstall: install }
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
