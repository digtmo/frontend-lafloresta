import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { MapContainer, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'

const TOKEN    = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const LA_CENTRO: [number, number] = [-37.4694, -72.3539]
const STYLE    = 'mapbox/light-v11'

export interface Marcador {
  lat: number; lng: number
  direccion: string; barrio: string | null
  cantidad: number; total: number; ultimaFecha: string
}

export default function MapaDensidad({ marcadores }: { marcadores: Marcador[] }) {
  return (
    <MapContainer center={LA_CENTRO} zoom={13} scrollWheelZoom={false} style={{ height: 460, width: '100%', borderRadius: '0.5rem' }}>
      <TileLayer
        url={`https://api.mapbox.com/styles/v1/${STYLE}/tiles/{z}/{x}/{y}?access_token=${TOKEN}`}
        tileSize={512} zoomOffset={-1}
        attribution='&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      <ClusterLayer marcadores={marcadores} />
    </MapContainer>
  )
}

function formatCLP(n: number) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) } catch { return iso }
}

function ClusterLayer({ marcadores }: { marcadores: Marcador[] }) {
  const map = useMap()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null)

  useEffect(() => {
    if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null }
    if (marcadores.length === 0) return

    const maxCantidad = Math.max(...marcadores.map((m) => m.cantidad), 1)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cluster = (L as any).markerClusterGroup({
      showCoverageOnHover: false, spiderfyOnMaxZoom: true,
      disableClusteringAtZoom: 16, maxClusterRadius: 45,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      iconCreateFunction: (c: any) => {
        const count = c.getChildCount()
        const size  = count < 10 ? 36 : count < 50 ? 44 : 52
        return L.divIcon({ html: `<div class="cluster-bubble"><span>${count}</span></div>`, className: 'cluster-icon-wrapper', iconSize: [size, size] })
      },
    })

    for (const m of marcadores) {
      const radius = 5 + (m.cantidad / maxCantidad) * 7
      const marker = L.circleMarker([m.lat, m.lng], { radius, color: '#5b7556', weight: 1.5, fillColor: '#87a181', fillOpacity: 0.85 })
      const popup = `<div class="map-popup"><p class="map-popup-direccion">${escapeHtml(m.direccion)}</p>${m.barrio ? `<p class="map-popup-barrio">${escapeHtml(m.barrio)}</p>` : ''}<div class="map-popup-stats"><div><span>Pedidos</span><strong>${m.cantidad}</strong></div><div><span>Ingreso</span><strong>${formatCLP(m.total)}</strong></div></div><p class="map-popup-fecha">Último: ${formatFecha(m.ultimaFecha)}</p></div>`
      marker.bindPopup(popup)
      cluster.addLayer(marker)
    }

    map.addLayer(cluster)
    layerRef.current = cluster
    return () => { if (layerRef.current) { map.removeLayer(layerRef.current); layerRef.current = null } }
  }, [map, marcadores])

  return null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
