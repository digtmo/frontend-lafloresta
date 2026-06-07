import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react'
import { apiUrl } from '@/lib/api'

export interface CrmEvent {
  role:      'user' | 'bot' | 'operator' | 'bot_image' | 'crm_estado' | 'crm_nueva'
  telefono?: string
  text?:     string
  ts?:       number
  id?:       string
}

type Listener = (ev: CrmEvent) => void
interface Ctx { sseOk: boolean; subscribe: (fn: Listener) => () => void }

const CrmEventsContext = createContext<Ctx | null>(null)

export function CrmEventsProvider({ children }: { children: ReactNode }) {
  const [sseOk, setSseOk] = useState(true)
  const listenersRef      = useRef<Set<Listener>>(new Set())

  useEffect(() => {
    let es: EventSource | null = null
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    let attempts = 0
    let cancelled = false

    const scheduleReconnect = () => {
      if (cancelled) return
      attempts = Math.min(attempts + 1, 5)
      const delay = Math.min(1000 * 2 ** attempts, 30_000)
      retryTimer = setTimeout(connect, delay)
    }

    const connect = () => {
      if (cancelled) return
      // SSE doesn't support custom headers — backend /api/crm/events has no auth
      es = new EventSource(apiUrl('/api/crm/events'))

      es.onopen = () => { attempts = 0; setSseOk(true) }

      es.onmessage = (e) => {
        let data: CrmEvent
        try { data = JSON.parse(e.data) } catch { return }

        if ((data as { error?: string }).error) {
          setSseOk(false); es?.close(); es = null; scheduleReconnect(); return
        }

        setSseOk(true)
        listenersRef.current.forEach((fn) => { try { fn(data) } catch { /* ignore */ } })
      }

      es.onerror = () => {
        setSseOk(false); es?.close(); es = null; scheduleReconnect()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (retryTimer) clearTimeout(retryTimer)
      es?.close()
    }
  }, [])

  const subscribe = useCallback((fn: Listener) => {
    listenersRef.current.add(fn)
    return () => { listenersRef.current.delete(fn) }
  }, [])

  const value = useMemo(() => ({ sseOk, subscribe }), [sseOk, subscribe])

  return <CrmEventsContext.Provider value={value}>{children}</CrmEventsContext.Provider>
}

export function useCrmEvents() {
  const ctx = useContext(CrmEventsContext)
  if (!ctx) throw new Error('useCrmEvents debe usarse dentro de CrmEventsProvider')
  return ctx
}

export function samePhone(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const na = a.replace(/\D/g, '')
  const nb = b.replace(/\D/g, '')
  if (!na || !nb) return false
  return na === nb || na.endsWith(nb) || nb.endsWith(na)
}
