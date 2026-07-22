import { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { apiFetch } from '@/lib/api'

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

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/**
 * Maneja las notificaciones push: pedir permiso, suscribirse (guardando la
 * suscripción en el backend) y desactivarlas. Solo funciona sobre el build de
 * producción (con service worker activo) y, en iOS, con la PWA ya instalada.
 */
export function usePushNotifications() {
  const supported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  const [permission, setPermission] = useState<NotificationPermission>(
    supported ? Notification.permission : 'denied',
  )
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supported) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => { /* SW aún no activo (dev) */ })
  }, [supported])

  const activar = useCallback(async () => {
    if (!supported || busy) return
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        toast.error('Permiso de notificaciones denegado')
        return
      }
      const { key } = await apiFetch<{ key: string }>('/api/push/public-key')
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      })
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      setSubscribed(true)
      toast.success('Notificaciones activadas')
    } catch (err) {
      console.error('[push] activar', err)
      toast.error('No se pudieron activar las notificaciones')
    } finally {
      setBusy(false)
    }
  }, [supported, busy])

  const desactivar = useCallback(async () => {
    if (!supported || busy) return
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await apiFetch('/api/push/unsubscribe', {
          method: 'POST',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => { /* seguimos aunque falle el backend */ })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      toast.success('Notificaciones desactivadas')
    } catch (err) {
      console.error('[push] desactivar', err)
    } finally {
      setBusy(false)
    }
  }, [supported, busy])

  return { supported, permission, subscribed, busy, activar, desactivar }
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
