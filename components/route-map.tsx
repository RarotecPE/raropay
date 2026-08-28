'use client'

import * as React from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export interface MapPoint {
  lat: number
  lng: number
  label: string
  kind: 'origin' | 'stop' | 'destination'
}

interface RouteMapProps {
  points: MapPoint[]
  geometry?: { lat: number; lng: number }[]
  className?: string
}

// Cores por tipo de ponto (usam a paleta do tema via valores diretos do Leaflet)
const KIND_COLOR: Record<MapPoint['kind'], string> = {
  origin: '#16a34a', // verde - partida
  stop: '#2563eb', // azul - parada
  destination: '#dc2626', // vermelho - destino
}

const KIND_LABEL: Record<MapPoint['kind'], string> = {
  origin: 'Partida',
  stop: 'Parada',
  destination: 'Destino',
}

// Cria um pino colorido via divIcon (evita problemas de assets de ícone do Leaflet com bundlers)
function makeIcon(color: string, text: string) {
  return L.divIcon({
    className: 'route-map-pin',
    html: `
      <div style="
        background:${color};
        width:26px;height:26px;border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2px solid #fff;
        box-shadow:0 1px 4px rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;">
        <span style="transform:rotate(45deg);color:#fff;font-size:11px;font-weight:700;font-family:sans-serif;">${text}</span>
      </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  })
}

// Ajusta o zoom/enquadramento para caber todos os pontos
function FitBounds({ points, geometry }: { points: MapPoint[]; geometry?: { lat: number; lng: number }[] }) {
  const map = useMap()

  React.useEffect(() => {
    const coords: [number, number][] = []
    points.forEach((p) => coords.push([p.lat, p.lng]))
    geometry?.forEach((g) => coords.push([g.lat, g.lng]))

    if (coords.length === 1) {
      map.setView(coords[0], 14)
    } else if (coords.length > 1) {
      map.fitBounds(L.latLngBounds(coords), { padding: [30, 30], maxZoom: 15 })
    }
  }, [map, points, geometry])

  return null
}

export default function RouteMap({ points, geometry, className }: RouteMapProps) {
  const validPoints = points.filter(
    (p) => typeof p.lat === 'number' && typeof p.lng === 'number' && !Number.isNaN(p.lat)
  )

  const center: [number, number] = validPoints.length
    ? [validPoints[0].lat, validPoints[0].lng]
    : [-8.05, -34.9] // fallback: Recife

  const line: [number, number][] =
    geometry && geometry.length > 1
      ? geometry.map((g) => [g.lat, g.lng])
      : validPoints.map((p) => [p.lat, p.lng])

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {line.length > 1 && (
        <Polyline positions={line} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.7 }} />
      )}

      {validPoints.map((p, i) => {
        const text =
          p.kind === 'origin' ? 'P' : p.kind === 'destination' ? 'D' : String(i)
        return (
          <Marker key={`${p.lat}-${p.lng}-${i}`} position={[p.lat, p.lng]} icon={makeIcon(KIND_COLOR[p.kind], text)}>
            <Popup>
              <strong>{KIND_LABEL[p.kind]}</strong>
              <br />
              {p.label}
            </Popup>
          </Marker>
        )
      })}

      <FitBounds points={validPoints} geometry={geometry} />
    </MapContainer>
  )
}
