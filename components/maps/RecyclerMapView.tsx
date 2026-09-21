'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { NearbyRecycler } from '@/lib/api/recyclers'
import { ExternalLink, MapPin, Navigation, Compass } from 'lucide-react'

interface RecyclerMapViewProps {
  userLocation?: { latitude: number; longitude: number } | null
  recyclers: NearbyRecycler[]
  selectedRecyclerId?: string | null
  onSelectRecycler?: (recycler: NearbyRecycler) => void
  radiusKm?: number
}

export default function RecyclerMapView({
  userLocation,
  recyclers,
  selectedRecyclerId,
  onSelectRecycler,
  radiusKm = 25,
}: RecyclerMapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return
    let map: any = null

    const initMap = async () => {
      const L = (await import('leaflet')).default

      // Determine initial center
      const initialLat = userLocation?.latitude || 17.385
      const initialLng = userLocation?.longitude || 78.4867

      if (!mapInstanceRef.current && mapContainerRef.current) {
        map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 12,
          zoomControl: true,
        })

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
        }).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
        mapInstanceRef.current = map
        setMapReady(true)
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
        markersLayerRef.current = null
        setMapReady(false)
      }
    }
  }, [])

  // Update markers when recyclers, userLocation, or selection changes
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !markersLayerRef.current) return

    const updateLayers = async () => {
      const L = (await import('leaflet')).default
      const layerGroup = markersLayerRef.current
      layerGroup.clearLayers()

      const bounds: [number, number][] = []

      // 1. Render User Marker & Radius Circle if available
      if (userLocation) {
        const userLat = userLocation.latitude
        const userLng = userLocation.longitude
        bounds.push([userLat, userLng])

        // User Pulse Marker
        const userIcon = L.divIcon({
          className: 'user-location-marker',
          html: `
            <div style="position: relative; width: 24px; height: 24px;">
              <span style="position: absolute; width: 24px; height: 24px; background: rgba(14, 165, 233, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
              <span style="position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; background: #0284c7; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        })

        const userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(layerGroup)
        userMarker.bindPopup(`
          <div style="font-family: inherit; font-size: 12px; padding: 2px;">
            <strong style="color: #0369a1; display: block; margin-bottom: 2px;">Your Location</strong>
            <span>${userLat.toFixed(4)}, ${userLng.toFixed(4)}</span>
          </div>
        `)

        // Search Radius Circle
        L.circle([userLat, userLng], {
          radius: (radiusKm || 25) * 1000,
          color: '#0284c7',
          fillColor: '#38bdf8',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '4, 6',
        }).addTo(layerGroup)
      }

      // 2. Render Recycler Facility Markers
      recyclers.forEach((r) => {
        const coords = r.locationCoordinates?.coordinates
        if (!coords || coords.length !== 2) return

        // GeoJSON: [longitude, latitude] -> Leaflet: [latitude, longitude]
        const lng = coords[0]
        const lat = coords[1]
        bounds.push([lat, lng])

        const isSelected = r.id === selectedRecyclerId

        const pinColor = isSelected ? '#0f766e' : '#059669'
        const borderRing = isSelected ? '4px solid #facc15' : '2px solid #ffffff'
        const scale = isSelected ? 'transform: scale(1.15);' : ''

        const recyclerIcon = L.divIcon({
          className: 'recycler-facility-marker',
          html: `
            <div style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; background: ${pinColor}; color: white; border-radius: 12px; border: ${borderRing}; box-shadow: 0 4px 10px rgba(0,0,0,0.25); transition: all 0.2s ease; ${scale}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
              </svg>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
          popupAnchor: [0, -32],
        })

        const marker = L.marker([lat, lng], { icon: recyclerIcon }).addTo(layerGroup)

        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

        const popupContent = `
          <div style="font-family: inherit; font-size: 13px; max-width: 220px; padding: 4px;">
            <div style="font-weight: 700; color: #0f172a; margin-bottom: 2px;">${r.businessName}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">${r.address || 'Verified facility'}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
              <span style="font-weight: 600; color: #059669;">${r.distanceKm} km away</span>
              <span style="background: #ecfdf5; color: #065f46; padding: 1px 6px; border-radius: 9999px; font-weight: 600;">Verified</span>
            </div>
            <div style="display: flex; gap: 4px;">
              <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #f1f5f9; color: #334155; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 4px;">
                Directions ↗
              </a>
              <a href="/recyclers/${r.id}" style="flex: 1; text-align: center; background: #059669; color: white; padding: 5px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-decoration: none;">
                Handover →
              </a>
            </div>
          </div>
        `

        marker.bindPopup(popupContent)

        marker.on('click', () => {
          if (onSelectRecycler) {
            onSelectRecycler(r)
          }
        })

        if (isSelected) {
          marker.openPopup()
          mapInstanceRef.current.panTo([lat, lng], { animate: true })
        }
      })

      // Auto-fit bounds if markers exist
      if (bounds.length > 1 && !selectedRecyclerId) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
      }
    }

    updateLayers()
  }, [mapReady, recyclers, userLocation, selectedRecyclerId, radiusKm, onSelectRecycler])

  const handleCenterUser = () => {
    if (mapInstanceRef.current && userLocation) {
      mapInstanceRef.current.setView([userLocation.latitude, userLocation.longitude], 13, {
        animate: true,
      })
    }
  }

  const mappedCount = recyclers.filter(
    (r) => r.locationCoordinates?.coordinates && r.locationCoordinates.coordinates.length === 2
  ).length

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-slate-100 flex flex-col">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[420px] z-10" />

      {/* Map Control Bar Overlay */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {userLocation && (
          <button
            type="button"
            onClick={handleCenterUser}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur text-slate-700 text-xs font-semibold shadow-md border border-gray-200 hover:bg-white transition"
            title="Center map on your location"
          >
            <Compass size={14} className="text-sky-600" />
            <span>My Location</span>
          </button>
        )}
      </div>

      {/* Bottom Summary Pill */}
      <div className="absolute bottom-3 left-3 z-20 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 shadow-md border border-gray-200 flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-500" />
        <span>
          {mappedCount} {mappedCount === 1 ? 'facility' : 'facilities'} on map
        </span>
        {radiusKm && <span className="text-gray-400">· {radiusKm} km radius</span>}
      </div>
    </div>
  )
}
