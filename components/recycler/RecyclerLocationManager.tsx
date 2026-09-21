'use client'

import React, { useEffect, useState } from 'react'
import {
  MapPin,
  Compass,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Save,
  Building2,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react'
import { recyclersApi, BackendRecycler } from '@/lib/api/recyclers'
import { useAuth } from '@/lib/authContext'

export default function RecyclerLocationManager() {
  const { user, isAuthenticated } = useAuth()

  const [profile, setProfile] = useState<BackendRecycler | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')

  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Load existing profile and location from backend
  const loadProfile = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await recyclersApi.getMyProfile()
      setProfile(data)

      const coords = data.locationCoordinates?.coordinates
      if (coords && coords.length === 2) {
        // GeoJSON: [longitude, latitude]
        setLongitude(String(coords[0]))
        setLatitude(String(coords[1]))
      } else {
        setLatitude('')
        setLongitude('')
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load facility location details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user?.role === 'recycler') {
      loadProfile()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user?.role])

  // Detect location via browser geolocation
  const handleDetectGPS = () => {
    setErrorMessage(null)
    setSuccessMessage(null)

    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by your browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6))
        const lng = Number(pos.coords.longitude.toFixed(6))
        setLatitude(String(lat))
        setLongitude(String(lng))
        setSuccessMessage('Coordinates detected from your browser. Click "Save Location" to apply.')
      },
      (err) => {
        setErrorMessage(
          err.code === 1
            ? 'Location permission denied by browser. Please enter coordinates manually.'
            : 'Could not detect browser location. Please enter coordinates manually.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Save/Update location coordinates
  const handleSaveLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setErrorMessage(null)
    setSuccessMessage(null)

    const latNum = parseFloat(latitude)
    const lngNum = parseFloat(longitude)

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setErrorMessage('Latitude must be a valid number between -90 and 90.')
      return
    }

    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setErrorMessage('Longitude must be a valid number between -180 and 180.')
      return
    }

    setSaving(true)
    try {
      await recyclersApi.updateMyLocation({
        latitude: latNum,
        longitude: lngNum,
      })
      setSuccessMessage('Facility location updated successfully! Nearby collectors can now discover your facility.')
      await loadProfile()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update facility location.')
    } finally {
      setSaving(false)
    }
  }

  // Clear/Remove location coordinates
  const handleClearLocation = async () => {
    if (!confirm('Are you sure you want to remove your facility location? Your facility will no longer appear in nearby discovery until coordinates are reconfigured.')) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setClearing(true)

    try {
      await recyclersApi.clearMyLocation()
      setLatitude('')
      setLongitude('')
      setSuccessMessage('Facility location removed successfully.')
      await loadProfile()
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to remove facility location.')
    } finally {
      setClearing(false)
    }
  }

  const hasConfiguredLocation = Boolean(
    profile?.hasLocation ||
      (profile?.locationCoordinates?.coordinates &&
        profile.locationCoordinates.coordinates.length === 2)
  )

  const activeCoords = profile?.locationCoordinates?.coordinates
  const mapsUrl =
    activeCoords && activeCoords.length === 2
      ? `https://www.google.com/maps?q=${activeCoords[1]},${activeCoords[0]}`
      : null

  if (loading) {
    return (
      <div className="card p-12 text-center text-gray-500">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="font-semibold text-slate-800">Loading facility location settings...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      {/* Current Status Card */}
      <div className="card p-6 md:p-8 bg-white border border-gray-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`size-12 rounded-2xl flex items-center justify-center shrink-0 ${
                hasConfiguredLocation
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
            >
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {profile?.businessName || profile?.organizationName || 'Recycling Facility'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Registration ID: {profile?.registrationId || 'REG-PENDING'}
              </p>
              <p className="text-sm text-gray-600 mt-2 flex items-center gap-1.5">
                <MapPin size={15} className="text-gray-400 shrink-0" />
                <span>{profile?.address || profile?.location || 'Address not configured'}</span>
              </p>
            </div>
          </div>

          <div>
            {hasConfiguredLocation ? (
              <span className="badge-success flex items-center gap-1">
                <ShieldCheck size={14} /> Location Active
              </span>
            ) : (
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 flex items-center gap-1">
                <AlertCircle size={13} /> No Coordinates Set
              </span>
            )}
          </div>
        </div>

        {hasConfiguredLocation && activeCoords && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-emerald-900">
            <div>
              <p className="font-semibold">Live Mapped Coordinates (GeoJSON Point):</p>
              <p className="font-mono mt-1 text-emerald-800">
                Longitude: {activeCoords[0].toFixed(6)} | Latitude: {activeCoords[1].toFixed(6)}
              </p>
            </div>

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline text-xs py-1 px-3 bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1"
              >
                <span>View on Maps</span>
                <ExternalLink size={12} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-start gap-2">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2">
          <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Coordinate Update Form */}
      <form onSubmit={handleSaveLocation} className="card p-6 md:p-8 bg-white border border-gray-200">
        <h3 className="font-bold text-lg text-slate-900 mb-1">Set Facility Coordinates</h3>
        <p className="text-sm text-gray-500 mb-6">
          Set the exact latitude and longitude for your facility. These coordinates are used by nearby collectors
          to calculate distance and locate your drop-off site on the map.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Latitude <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="e.g. 17.3850"
              required
              className="form-input text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Value between -90.0 and 90.0</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Longitude <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="e.g. 78.4867"
              required
              className="form-input text-sm"
            />
            <p className="text-[11px] text-gray-400 mt-1">Value between -180.0 and 180.0</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-8 pt-6 border-t border-gray-100">
          <button
            type="button"
            onClick={handleDetectGPS}
            className="btn-outline text-xs flex items-center gap-1.5"
          >
            <Compass size={14} />
            <span>Detect via GPS</span>
          </button>

          <div className="flex items-center gap-2">
            {hasConfiguredLocation && (
              <button
                type="button"
                onClick={handleClearLocation}
                disabled={clearing || saving}
                className="btn-ghost text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-1"
              >
                <Trash2 size={14} />
                <span>{clearing ? 'Removing...' : 'Remove Location'}</span>
              </button>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>{saving ? 'Saving...' : 'Save Location'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
