'use client'

import React, { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Building2,
  Compass,
  MapPin,
  Search,
  ShieldCheck,
  ArrowRight,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  SlidersHorizontal,
  Navigation,
  Globe,
  Layers,
} from 'lucide-react'
import { recyclersApi, NearbyRecycler } from '@/lib/api/recyclers'
import { useAuth } from '@/lib/authContext'

// Dynamically import map component with SSR disabled
const RecyclerMapView = dynamic(() => import('@/components/maps/RecyclerMapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[420px] rounded-2xl bg-slate-100 border border-gray-200 flex flex-col items-center justify-center text-gray-500 gap-3">
      <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-sm font-medium">Loading interactive facility map...</span>
    </div>
  ),
})

const CITY_PRESETS = [
  { label: 'Hyderabad Center', lat: 17.385, lng: 78.4867 },
  { label: 'HITEC City', lat: 17.4435, lng: 78.3772 },
  { label: 'Secunderabad', lat: 17.4399, lng: 78.4983 },
]

export default function RecyclerDiscovery() {
  const { isAuthenticated } = useAuth()

  // Location state
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(
    null
  )
  const [locationStatus, setLocationStatus] = useState<
    'idle' | 'detecting' | 'granted' | 'denied' | 'unavailable' | 'manual'
  >('idle')
  const [locationError, setLocationError] = useState<string | null>(null)

  // Query parameters
  const [radiusKm, setRadiusKm] = useState<number>(25)
  const [searchQuery, setSearchQuery] = useState('')
  const [manualLat, setManualLat] = useState('17.385')
  const [manualLng, setManualLng] = useState('78.4867')
  const [showManualForm, setShowManualForm] = useState(false)

  // Results & UI state
  const [recyclers, setRecyclers] = useState<NearbyRecycler[]>([])
  const [loading, setLoading] = useState(false)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [selectedRecyclerId, setSelectedRecyclerId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'both' | 'map' | 'list'>('both')

  // Request browser geolocation safely
  const requestGeolocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      setLocationError('Geolocation is not supported by your browser. Please enter coordinates manually.')
      return
    }

    setLocationStatus('detecting')
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: Number(position.coords.latitude.toFixed(4)),
          longitude: Number(position.coords.longitude.toFixed(4)),
        }
        setUserLocation(coords)
        setManualLat(String(coords.latitude))
        setManualLng(String(coords.longitude))
        setLocationStatus('granted')
        fetchNearby(coords.latitude, coords.longitude, radiusKm)
      },
      (err) => {
        let msg = 'Could not obtain location.'
        if (err.code === err.PERMISSION_DENIED) {
          msg = 'Location permission was denied in your browser settings. You can select a city preset or enter coordinates manually below.'
          setLocationStatus('denied')
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          msg = 'Location information is currently unavailable. Please select a city preset or enter coordinates manually.'
          setLocationStatus('unavailable')
        } else if (err.code === err.TIMEOUT) {
          msg = 'Location detection timed out. Please try again or use manual coordinates.'
          setLocationStatus('unavailable')
        }
        setLocationError(msg)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    )
  }

  // Fetch nearby recyclers from backend
  const fetchNearby = async (lat: number, lng: number, radius: number) => {
    setLoading(true)
    setQueryError(null)

    try {
      const data = await recyclersApi.getNearbyRecyclers({
        latitude: lat,
        longitude: lng,
        radiusKm: radius,
        limit: 20,
      })
      setRecyclers(data)
      if (data.length > 0 && !selectedRecyclerId) {
        setSelectedRecyclerId(data[0].id)
      }
    } catch (err: any) {
      setQueryError(err.message || 'Failed to fetch nearby recyclers from backend.')
    } finally {
      setLoading(false)
    }
  }

  // Apply manual coordinates or preset
  const handleApplyCoordinates = (latVal?: number, lngVal?: number) => {
    const targetLat = latVal !== undefined ? latVal : parseFloat(manualLat)
    const targetLng = lngVal !== undefined ? lngVal : parseFloat(manualLng)

    if (isNaN(targetLat) || targetLat < -90 || targetLat > 90) {
      setLocationError('Please enter a valid latitude between -90 and 90.')
      return
    }
    if (isNaN(targetLng) || targetLng < -180 || targetLng > 180) {
      setLocationError('Please enter a valid longitude between -180 and 180.')
      return
    }

    const coords = { latitude: targetLat, longitude: targetLng }
    setUserLocation(coords)
    setManualLat(String(targetLat))
    setManualLng(String(targetLng))
    setLocationStatus('manual')
    setLocationError(null)
    fetchNearby(targetLat, targetLng, radiusKm)
  }

  // Handle radius change
  const handleRadiusChange = (newRadius: number) => {
    setRadiusKm(newRadius)
    if (userLocation) {
      fetchNearby(userLocation.latitude, userLocation.longitude, newRadius)
    }
  }

  // On initial mount, default to city preset for instant discovery
  useEffect(() => {
    const defaultCoords = { latitude: 17.385, longitude: 78.4867 }
    setUserLocation(defaultCoords)
    setLocationStatus('manual')
    fetchNearby(defaultCoords.latitude, defaultCoords.longitude, 25)
  }, [])

  // Filtered list by optional text query
  const filteredRecyclers = recyclers.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.businessName.toLowerCase().includes(q) ||
      (r.address && r.address.toLowerCase().includes(q))
    )
  })

  return (
    <div className="flex flex-col gap-6">
      {/* Top Location & Filter Bar */}
      <div className="card p-5 md:p-6 bg-white shadow-sm border border-gray-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Location Status & Detector */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={requestGeolocation}
              disabled={locationStatus === 'detecting'}
              className="btn-primary text-sm flex items-center gap-2"
            >
              <Compass size={16} className={locationStatus === 'detecting' ? 'animate-spin' : ''} />
              <span>{locationStatus === 'detecting' ? 'Detecting...' : 'Use My GPS Location'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowManualForm(!showManualForm)}
              className="btn-outline text-sm flex items-center gap-1.5"
            >
              <MapPin size={15} />
              <span>{showManualForm ? 'Hide Coordinates' : 'Set Location Coordinates'}</span>
            </button>

            {/* City Preset Shortcuts */}
            <div className="hidden sm:flex items-center gap-1 text-xs text-gray-500">
              <span className="font-semibold text-gray-400 uppercase tracking-wider mr-1">Presets:</span>
              {CITY_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleApplyCoordinates(preset.lat, preset.lng)}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                    userLocation?.latitude === preset.lat && userLocation?.longitude === preset.lng
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search Radius Pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Radius:</span>
            {[10, 25, 50, 100].map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => handleRadiusChange(km)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                  radiusKm === km
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>

        {/* Manual Coordinates Form Drawer */}
        {showManualForm && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Latitude</label>
              <input
                type="number"
                step="0.0001"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                placeholder="17.3850"
                className="form-input text-sm py-1.5"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Longitude</label>
              <input
                type="number"
                step="0.0001"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                placeholder="78.4867"
                className="form-input text-sm py-1.5"
              />
            </div>
            <button
              type="button"
              onClick={() => handleApplyCoordinates()}
              className="btn-secondary text-sm py-2"
            >
              Update Search Center
            </button>
          </div>
        )}

        {/* Location Alerts */}
        {locationError && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <span>{locationError}</span>
          </div>
        )}

        {/* Active Coordinate Context Pill */}
        {userLocation && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500" />
              <span>
                Searching around:{' '}
                <strong className="text-slate-800">
                  {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                </strong>{' '}
                ({locationStatus === 'granted' ? 'Browser Geolocation' : 'Configured Coordinates'})
              </span>
            </div>
            <span className="font-medium text-emerald-700">
              {filteredRecyclers.length} verified facilities found within {radiusKm} km
            </span>
          </div>
        )}
      </div>

      {/* Query Error State */}
      {queryError && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{queryError}</span>
          </div>
          <button
            onClick={() =>
              userLocation && fetchNearby(userLocation.latitude, userLocation.longitude, radiusKm)
            }
            className="text-xs font-bold text-rose-700 underline flex items-center gap-1"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Search and Layout Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-3 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search nearby facilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input pl-9 py-2 text-sm"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs font-medium text-gray-400">View:</span>
          {(['both', 'map', 'list'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                viewMode === mode
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area: Split Map & Facility List */}
      <div
        className={`grid gap-6 ${
          viewMode === 'both' ? 'lg:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        {/* Map Column */}
        {(viewMode === 'both' || viewMode === 'map') && (
          <div className={viewMode === 'both' ? 'lg:col-span-6 xl:col-span-7 h-[560px]' : 'h-[620px]'}>
            <RecyclerMapView
              userLocation={userLocation}
              recyclers={filteredRecyclers}
              selectedRecyclerId={selectedRecyclerId}
              onSelectRecycler={(r) => setSelectedRecyclerId(r.id)}
              radiusKm={radiusKm}
            />
          </div>
        )}

        {/* Facility List Column */}
        {(viewMode === 'both' || viewMode === 'list') && (
          <div
            className={`flex flex-col gap-4 overflow-y-auto ${
              viewMode === 'both' ? 'lg:col-span-6 xl:col-span-5 max-h-[560px] pr-1' : ''
            }`}
          >
            {loading ? (
              <div className="card p-12 text-center text-gray-500">
                <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="font-semibold text-slate-800">Searching nearby recyclers...</p>
                <p className="text-xs text-gray-400 mt-1">
                  Querying verified facilities with active location coordinates
                </p>
              </div>
            ) : filteredRecyclers.length === 0 ? (
              <div className="card p-10 text-center bg-white">
                <div className="size-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Building2 size={26} />
                </div>
                <h3 className="font-bold text-slate-900 text-base">No recyclers found within {radiusKm} km</h3>
                <p className="text-xs text-gray-500 mt-2 max-w-sm mx-auto leading-relaxed">
                  There are no verified recyclers with mapped facilities in this immediate radius. Try expanding
                  your search radius to 50 km or 100 km, or browse our complete platform catalog.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => handleRadiusChange(100)}
                    className="btn-primary text-xs py-2 px-3"
                  >
                    Expand to 100 km
                  </button>
                  <Link href="/recyclers" className="btn-outline text-xs py-2 px-3">
                    View Full Directory
                  </Link>
                </div>
              </div>
            ) : (
              filteredRecyclers.map((r) => {
                const isSelected = r.id === selectedRecyclerId
                const coords = r.locationCoordinates?.coordinates
                const directionsUrl =
                  coords && coords.length === 2
                    ? `https://www.google.com/maps/dir/?api=1&destination=${coords[1]},${coords[0]}`
                    : null

                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedRecyclerId(r.id)}
                    className={`card p-5 transition-all cursor-pointer border ${
                      isSelected
                        ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                            isSelected
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          <Building2 size={20} />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 text-base leading-tight">
                            {r.businessName}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin size={13} className="shrink-0 text-gray-400" />
                            <span>{r.address || 'Authorized facility'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-sm font-bold text-emerald-700">
                          {r.distanceKm} km
                        </span>
                        {r.isVerified && (
                          <span className="badge-success text-[10px] py-0.5 px-2">
                            <ShieldCheck size={11} className="mr-0.5" />
                            Verified
                          </span>
                        )}
                      </div>
                    </div>

                    {r.description && (
                      <p className="text-xs text-gray-600 mt-3 line-clamp-2 leading-relaxed">
                        {r.description}
                      </p>
                    )}

                    {/* Action Buttons: Handover & Directions */}
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
                      {directionsUrl && (
                        <a
                          href={directionsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="btn-ghost text-xs py-1.5 px-2.5 text-gray-600 flex items-center gap-1 hover:text-slate-900"
                        >
                          <Navigation size={13} />
                          <span>Directions</span>
                          <ExternalLink size={11} className="text-gray-400" />
                        </a>
                      )}

                      <Link
                        href={`/recyclers/${r.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-primary text-xs py-1.5 px-3 ml-auto flex items-center gap-1.5"
                      >
                        <span>Select & Handover</span>
                        <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
