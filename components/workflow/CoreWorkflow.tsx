'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  Send,
  ShieldCheck,
  Star,
  Truck,
  X,
  XCircle,
  Navigation,
  ExternalLink,
} from 'lucide-react'
import PageHeader from '@/components/layout/PageHeader'
import DashboardLayout from '@/components/layout/DashboardLayout'
import { useWorkflow, mockRecyclers as defaultMockRecyclers } from '@/components/shared/WorkflowContext'
import { mockMaterials, mockCollectors, Recycler } from '@/data/mockData'
import { useAuth } from '@/lib/authContext'
import { wasteApi, WasteItem } from '@/lib/api/waste'
import { requestsApi, HandoverRequestItem } from '@/lib/api/requests'
import { recyclersApi } from '@/lib/api/recyclers'
import { handoversApi, HandoverRecordItem } from '@/lib/api/handovers'
import { transactionsApi, TransactionItem } from '@/lib/api/transactions'

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

const collectorNav = [
  { label: 'Dashboard', href: '/collector/dashboard', icon: CheckCircle2 },
  { label: 'Waste Inventory', href: '/collector/inventory', icon: Package },
  { label: 'Find Recyclers', href: '/collector/recyclers', icon: CheckCircle2 },
  { label: 'Handover Requests', href: '/collector/requests', icon: CheckCircle2 },
  { label: 'Transactions', href: '/collector/transactions', icon: CheckCircle2 },
  { label: 'Earnings', href: '/collector/earnings', icon: CheckCircle2 },
]

const recyclerNav = [
  { label: 'Dashboard', href: '/recycler/dashboard', icon: CheckCircle2 },
  { label: 'Incoming Requests', href: '/recycler/requests', icon: CheckCircle2 },
  { label: 'Accepted Requests', href: '/recycler/accepted', icon: CheckCircle2 },
  { label: 'Completed Handovers', href: '/recycler/completed', icon: CheckCircle2 },
]

function Shell({ children, recycler = false }: { children: React.ReactNode; recycler?: boolean }) {
  const { user } = useAuth()
  const activeRole = (user?.role as 'collector' | 'recycler') || (recycler ? 'recycler' : 'collector')
  const defaultName = activeRole === 'recycler' ? 'GreenCycle Recycling' : 'Ravi Kumar'
  const userName = user?.name || defaultName
  const items = activeRole === 'recycler' ? recyclerNav : collectorNav

  return (
    <DashboardLayout userRole={activeRole} userName={userName} items={items}>
      {children}
    </DashboardLayout>
  )
}

function Timeline({ status }: { status: string }) {
  const steps = [
    { key: 'item_added', label: 'E-Waste In Inventory' },
    { key: 'pending', label: 'Request Sent (Pending)' },
    { key: 'accepted', label: 'Request Accepted' },
    { key: 'scheduled', label: 'Handover Scheduled' },
    { key: 'in_transit', label: 'In Transit' },
    { key: 'completed', label: 'Handover Completed' },
  ]

  const statusRanks: Record<string, number> = {
    pending: 1,
    accepted: 2,
    scheduled: 3,
    in_transit: 4,
    completed: 5,
    rejected: 1,
    cancelled: 1,
  }

  const currentRank = statusRanks[status] ?? 1

  return (
    <div className="flex flex-col gap-4">
      {status === 'rejected' && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
          <XCircle size={16} className="text-rose-600 shrink-0" />
          Request was rejected by recycler
        </div>
      )}
      {status === 'cancelled' && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 font-medium">
          <AlertCircle size={16} className="text-amber-600 shrink-0" />
          Request was cancelled by collector
        </div>
      )}
      {steps.map((step, idx) => {
        const isDone = idx <= currentRank && status !== 'rejected' && status !== 'cancelled'
        const isCurrent = step.key === status
        return (
          <div key={step.label} className="flex items-center gap-3">
            <div
              className={`size-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors ${
                isDone
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {isDone ? <Check size={14} /> : idx + 1}
            </div>
            <span
              className={`text-sm ${
                isCurrent ? 'font-bold text-slate-950' : isDone ? 'text-slate-800' : 'text-gray-400'
              }`}
            >
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function RecyclerDetails({ id }: { id: string }) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [recycler, setRecycler] = useState<Recycler | null>(null)
  const [open, setOpen] = useState(false)
  const [loadingRecycler, setLoadingRecycler] = useState(true)

  // Real collector waste items for modal
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([])
  const [loadingWaste, setLoadingWaste] = useState(false)
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([])
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    return d.toISOString().slice(0, 10)
  })
  const [notes, setNotes] = useState('Please confirm a convenient handover slot.')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [rawRecycler, setRawRecycler] = useState<any>(null)

  // Load Recycler details from backend
  useEffect(() => {
    let mounted = true
    recyclersApi
      .getRecyclerById(id)
      .then((rec: any) => {
        if (!mounted || !rec) return
        setRawRecycler(rec)
        setRecycler({
          id: rec.id || rec._id,
          name: rec.businessName || rec.organizationName || 'Authorized Recycler',
          registrationId: rec.registrationId || 'REG-HYD-2026',
          location: rec.address || rec.location || 'Hyderabad',
          phone: rec.user?.phone || '',
          email: rec.user?.email || '',
          distance: rec.distance ?? 0,
          acceptedMaterials: rec.acceptedMaterials || ['Computers', 'Cables', 'Batteries'],
          operatingHours: rec.operatingHours || '9 AM - 6 PM, Mon-Sat',
          verified: Boolean(rec.isVerified || rec.verificationStatus === 'verified'),
          rating: rec.user?.rating || 4.8,
          processingCategories: rec.processingCategories || ['E-waste Dismantling'],
          about: rec.description || rec.about || 'Authorized e-waste processing facility.',
        })
      })
      .catch(() => {
        recyclersApi
          .getRecyclers()
          .then((list) => {
            if (!mounted) return
            const found = list.find((r) => r.id === id) || list[0] || defaultMockRecyclers[0]
            setRecycler(found)
          })
          .catch(() => {
            if (!mounted) return
            const fallback = defaultMockRecyclers.find((r) => r.id === id) || defaultMockRecyclers[0]
            setRecycler(fallback)
          })
      })
      .finally(() => {
        if (mounted) setLoadingRecycler(false)
      })
    return () => {
      mounted = false
    }
  }, [id])

  // Open Handover Modal: fetch real available waste items
  const handleOpenModal = async () => {
    setOpen(true)
    setSubmitError(null)
    if (isAuthenticated && user?.role === 'collector') {
      setLoadingWaste(true)
      try {
        const items = await wasteApi.getMyWasteItems()
        const available = items.filter((item) => item.status === 'available')
        setWasteItems(available)
        if (available.length > 0) {
          setSelectedItemIds([available[0].id])
        }
      } catch (err: any) {
        console.error('Error fetching collector waste inventory:', err)
        setSubmitError(err.message || 'Could not load your available waste items')
      } finally {
        setLoadingWaste(false)
      }
    }
  }

  const toggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((i) => i !== itemId) : [...prev, itemId]
    )
  }

  // Selected totals
  const selectedSummary = useMemo(() => {
    const selected = wasteItems.filter((w) => selectedItemIds.includes(w.id))
    const totalKg = selected.reduce((sum, w) => sum + w.quantityKg, 0)
    const totalValue = selected.reduce((sum, w) => sum + w.estimatedValue, 0)
    return { count: selected.length, totalKg, totalValue }
  }, [wasteItems, selectedItemIds])

  // Submit Real Handover Request
  const handleSubmitRequest = async () => {
    if (!recycler) return
    if (!isAuthenticated || user?.role !== 'collector') {
      router.push('/login')
      return
    }

    if (selectedItemIds.length === 0) {
      setSubmitError('Please select at least one available waste item from your inventory.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const created = await requestsApi.createRequest({
        recyclerId: recycler.id,
        wasteItemIds: selectedItemIds,
        requestedDate: preferredDate,
        collectorMessage: notes,
        notes: notes,
      })

      setOpen(false)
      router.push(`/collector/requests/${created.id}`)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit handover request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentRecycler = recycler || defaultMockRecyclers[0]

  return (
    <>
      <PageHeader
        title={currentRecycler.name}
        description="Verified recycling partner for responsible material recovery."
      />
      <div className="container-app py-8">
        <Link
          href="/collector/recyclers"
          className="text-sm text-primary font-semibold inline-flex items-center gap-2 mb-6"
        >
          <ArrowLeft size={15} />
          Back to recyclers
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-7 lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-4">
                <div className="size-14 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Building2 size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{currentRecycler.name}</h2>
                  <p className="text-gray-500 mt-1 flex items-center gap-1 text-sm">
                    <MapPin size={15} />
                    {currentRecycler.location} · {currentRecycler.distance} km away
                  </p>
                </div>
              </div>
              <span className="badge-success">
                <ShieldCheck size={14} className="mr-1" />
                Verified
              </span>
            </div>

            <p className="text-gray-600 leading-relaxed mt-7">
              {currentRecycler.about ??
                'A trusted facility focused on responsible collection, processing and material recovery.'}
            </p>

            <div className="grid sm:grid-cols-2 gap-5 mt-7 pt-6 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Operating hours</p>
                <p className="font-semibold mt-2 text-slate-900">{currentRecycler.operatingHours}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Rating</p>
                <p className="font-semibold mt-2 flex items-center gap-1 text-slate-900">
                  <Star size={15} className="text-amber-500 fill-amber-500" />
                  {currentRecycler.rating} / 5
                </p>
              </div>
            </div>

            <h3 className="font-bold mt-8 text-slate-900">Materials accepted</h3>
            <div className="flex flex-wrap gap-2 mt-3">
              {currentRecycler.acceptedMaterials.map((item) => (
                <span className="badge-primary" key={item}>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="h-40 rounded-2xl bg-[linear-gradient(135deg,#d1fae5,#e0f2fe)] flex items-center justify-center text-emerald-700">
              <MapPin size={38} />
            </div>
            <p className="font-semibold mt-5 text-slate-900">Facility location</p>
            <p className="text-sm text-gray-500 mt-1">{currentRecycler.location}</p>
            <p className="text-xs text-gray-400 mt-2">Registration ID: {currentRecycler.registrationId}</p>
            {rawRecycler?.locationCoordinates?.coordinates && (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${rawRecycler.locationCoordinates.coordinates[1]},${rawRecycler.locationCoordinates.coordinates[0]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline text-xs w-full mt-3 py-2 flex items-center justify-center gap-1.5 text-gray-700"
              >
                <Navigation size={13} />
                <span>Open in Google Maps</span>
                <ExternalLink size={11} />
              </a>
            )}
            <button
              className="btn-primary w-full mt-4"
              onClick={handleOpenModal}
            >
              <Send size={16} className="mr-2" />
              Request Handover
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Real Collector -> Recycler Handover Request */}
      {open && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-7 w-full max-w-xl shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Send Handover Request</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Requesting handover to {currentRecycler.name}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            {submitError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {loadingWaste ? (
              <div className="py-12 flex flex-col items-center justify-center text-gray-500 gap-2">
                <Loader2 className="animate-spin text-emerald-600" size={26} />
                <p className="text-sm">Loading your available waste inventory...</p>
              </div>
            ) : wasteItems.length === 0 ? (
              <div className="py-8 text-center">
                <div className="size-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center mb-3">
                  <Package size={26} />
                </div>
                <h3 className="font-bold text-slate-900">No Available Waste Items</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                  You do not have any active, available waste items in your inventory right now. Please add
                  e-waste first.
                </p>
                <div className="flex justify-center gap-3 mt-6">
                  <button onClick={() => setOpen(false)} className="btn-outline">
                    Close
                  </button>
                  <Link href="/collector/add-waste" className="btn-primary">
                    Add E-Waste Now
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 mt-5">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 block mb-2">
                    Select Waste Items From Inventory ({selectedSummary.count} selected)
                  </label>
                  <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                    {wasteItems.map((item) => {
                      const mat =
                        typeof item.materialId === 'object' ? item.materialId : null
                      const matName = mat?.name || 'Electronic Waste'
                      const isSelected = selectedItemIds.includes(item.id)

                      return (
                        <div
                          key={item.id}
                          onClick={() => toggleSelectItem(item.id)}
                          className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`size-5 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'border-gray-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check size={14} />}
                            </div>
                            {item.photo?.url ? (
                              <img
                                src={item.photo.url}
                                alt={matName}
                                className="size-9 rounded-lg object-cover border border-emerald-200 shrink-0"
                              />
                            ) : (
                              <div className="size-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0 text-gray-400">
                                <Package size={16} />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-semibold text-slate-900">{matName}</p>
                              <p className="text-xs text-gray-500">
                                {item.quantityKg} kg · Est. {money(item.estimatedValue)}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                            {money(item.estimatedValue)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Handover Summary */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-500">Total Quantity:</span>{' '}
                    <span className="font-bold text-slate-900">{selectedSummary.totalKg} kg</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Estimated Value:</span>{' '}
                    <span className="font-bold text-emerald-700">{money(selectedSummary.totalValue)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Preferred Date
                    <input
                      type="date"
                      className="form-input mt-1.5"
                      value={preferredDate}
                      onChange={(e) => setPreferredDate(e.target.value)}
                      min={new Date().toISOString().slice(0, 10)}
                      required
                    />
                  </label>
                  <label className="text-sm font-medium text-slate-700">
                    Target Facility
                    <input
                      className="form-input mt-1.5 bg-gray-50 text-gray-600"
                      value={currentRecycler.name}
                      readOnly
                    />
                  </label>
                </div>

                <label className="text-sm font-medium text-slate-700">
                  Notes / Message to Recycler
                  <textarea
                    className="form-input mt-1.5"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Specify handover instructions, timing, or access notes..."
                  />
                </label>

                <div className="flex gap-3 mt-4 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    className="btn-outline flex-1"
                    onClick={() => setOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-primary flex-1 justify-center disabled:opacity-50"
                    disabled={submitting || selectedItemIds.length === 0}
                    onClick={handleSubmitRequest}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="animate-spin" size={16} /> Submitting...
                      </span>
                    ) : (
                      'Send Request'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function RequestDetails({ id, recycler = false }: { id: string; recycler?: boolean }) {
  const { user } = useAuth()
  const [request, setRequest] = useState<HandoverRequestItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)

  // Modals for actions
  const [selectedPreviewPhoto, setSelectedPreviewPhoto] = useState<string | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  })

  // Fetch real request
  const loadRequest = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await requestsApi.getRequestById(id)
      setRequest(data)
    } catch (err: any) {
      setError(err.message || 'Could not load request details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequest()
  }, [id])

  // Recycler: Accept
  const handleAccept = async () => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const updated = await requestsApi.acceptRequest(id)
      setRequest(updated)
      setActionMessage('Request accepted successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to accept request')
    } finally {
      setActionLoading(false)
    }
  }

  // Recycler: Reject
  const handleReject = async () => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const updated = await requestsApi.rejectRequest(id, {
        reason: rejectReason || 'Facility capacity or material specification constraint',
      })
      setRequest(updated)
      setShowRejectModal(false)
      setActionMessage('Request rejected.')
    } catch (err: any) {
      setError(err.message || 'Failed to reject request')
    } finally {
      setActionLoading(false)
    }
  }

  // Recycler: Schedule
  const handleSchedule = async () => {
    if (!scheduledDate) {
      setError('Please select a pickup/handover date.')
      return
    }
    setActionLoading(true)
    setActionMessage(null)
    try {
      const updated = await requestsApi.scheduleRequest(id, { scheduledDate })
      setRequest(updated)
      setShowScheduleModal(false)
      setActionMessage('Handover scheduled successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to schedule request')
    } finally {
      setActionLoading(false)
    }
  }

  // Recycler or Collector: Mark In-Transit
  const handleMarkInTransit = async () => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const updated = await requestsApi.markRequestInTransit(id)
      setRequest(updated)
      setActionMessage('Handover status updated to In Transit.')
    } catch (err: any) {
      setError(err.message || 'Failed to mark request in transit')
    } finally {
      setActionLoading(false)
    }
  }

  // Collector: Cancel
  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this handover request? Your items will return to available inventory.')) {
      return
    }
    setActionLoading(true)
    setActionMessage(null)
    try {
      const updated = await requestsApi.cancelRequest(id)
      setRequest(updated)
      setActionMessage('Request cancelled. Items have been released back to your inventory.')
    } catch (err: any) {
      setError(err.message || 'Failed to cancel request')
    } finally {
      setActionLoading(false)
    }
  }

  // Modals for completion
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')

  // Recycler or Collector: Complete Handover (only allowed when in_transit)
  const handleComplete = async () => {
    setActionLoading(true)
    setActionMessage(null)
    try {
      const res = await requestsApi.completeRequest(id, {
        notes: completionNotes || 'Handover verified and materials received at facility.',
      })
      setRequest(res.request)
      setShowCompleteModal(false)
      setActionMessage('Handover completed successfully! Digital Handover Record & Settlement created.')
    } catch (err: any) {
      setError(err.message || 'Failed to complete handover')
      if (err.message?.includes('already been completed')) {
        loadRequest()
      }
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <Shell recycler={recycler}>
        <div className="container-app py-20 flex flex-col items-center justify-center text-gray-500 gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
          <p className="text-sm">Loading handover request details...</p>
        </div>
      </Shell>
    )
  }

  if (error && !request) {
    return (
      <Shell recycler={recycler}>
        <PageHeader title="Handover Request" description="Track your handover." />
        <div className="container-app py-12 max-w-lg mx-auto text-center">
          <div className="card p-8">
            <XCircle className="size-12 text-rose-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-slate-900">Request Not Found</h2>
            <p className="text-sm text-gray-500 mt-2">{error}</p>
            <Link
              href={recycler ? '/recycler/requests' : '/collector/requests'}
              className="btn-primary mt-6 inline-block"
            >
              Back to requests
            </Link>
          </div>
        </div>
      </Shell>
    )
  }

  if (!request) return null

  // Populated fields
  const rec = typeof request.recyclerId === 'object' ? request.recyclerId : null
  const col = typeof request.collectorId === 'object' ? request.collectorId : null
  const recyclerName = rec?.organizationName || rec?.businessName || 'Authorized Recycler'
  const collectorName = col?.name || 'Collector'

  const itemsList = Array.isArray(request.wasteItemIds) ? (request.wasteItemIds as any[]) : []

  return (
    <Shell recycler={recycler}>
      <PageHeader
        title={`Request ${request.id.slice(-6).toUpperCase()}`}
        description={
          recycler
            ? 'Review and manage this incoming collector handover request.'
            : 'Track your handover from request to scheduled pickup.'
        }
      />
      <div className="container-app py-8">
        <Link
          href={recycler ? '/recycler/requests' : '/collector/requests'}
          className="text-sm text-primary font-semibold inline-flex items-center gap-2 mb-6"
        >
          <ArrowLeft size={15} />
          Back to all requests
        </Link>

        {actionMessage && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800 flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="card p-7 lg:col-span-2">
            <div className="flex justify-between items-start gap-4 flex-wrap">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Total Valuation
                </p>
                <h2 className="text-3xl font-bold text-slate-950 mt-1">
                  {money(request.estimatedValue)}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Calculated server-side based on verified material intake prices
                </p>
              </div>
              <span
                className={`text-xs uppercase font-bold px-3 py-1.5 rounded-full ${
                  request.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : request.status === 'accepted' || request.status === 'scheduled' || request.status === 'in_transit'
                    ? 'bg-sky-100 text-sky-800 border border-sky-300'
                    : request.status === 'rejected' || request.status === 'cancelled'
                    ? 'bg-rose-100 text-rose-800 border border-rose-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}
              >
                {request.status.replace('_', ' ')}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 gap-5 mt-8 pt-6 border-t border-gray-100">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Collector</p>
                <p className="font-semibold text-slate-900 mt-1">{collectorName}</p>
                {col?.phone && <p className="text-xs text-gray-500">{col.phone}</p>}
                {col?.location && <p className="text-xs text-gray-500">{col.location}</p>}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Recycler Facility</p>
                <p className="font-semibold text-slate-900 mt-1">{recyclerName}</p>
                {rec?.location && <p className="text-xs text-gray-500">{rec.location}</p>}
                {rec?.operatingHours && <p className="text-xs text-gray-500">{rec.operatingHours}</p>}
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Total Weight</p>
                <p className="font-semibold text-slate-900 mt-1">{request.totalQuantityKg} kg</p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">Requested Date</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {request.requestedDate ? request.requestedDate.slice(0, 10) : 'Flexible'}
                </p>
              </div>

              {request.scheduledDate && (
                <div className="sm:col-span-2 p-3.5 rounded-xl bg-sky-50 border border-sky-200">
                  <p className="text-xs uppercase tracking-wide text-sky-800 font-semibold">
                    Scheduled Pickup Date
                  </p>
                  <p className="font-bold text-sky-950 mt-1 text-base">
                    {request.scheduledDate.slice(0, 10)}
                  </p>
                </div>
              )}

              {request.collectorMessage && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                    Collector Message
                  </p>
                  <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-3 rounded-xl">
                    {request.collectorMessage}
                  </p>
                </div>
              )}

              {request.recyclerMessage && (
                <div className="sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                    Recycler Response / Notes
                  </p>
                  <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-3 rounded-xl">
                    {request.recyclerMessage}
                  </p>
                </div>
              )}
            </div>

            {/* Waste Items Included */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              <h3 className="font-bold text-slate-900 mb-3">Included Waste Items</h3>
              <div className="space-y-2">
                {itemsList.map((item: any, idx: number) => {
                  const matName = item?.materialId?.name || 'Waste Item'
                  const kg = item?.quantityKg || 0
                  const val = item?.estimatedValue || 0
                  return (
                    <div
                      key={item._id || item.id || idx}
                      className="p-3.5 bg-gray-50 rounded-xl flex items-center justify-between text-sm gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.photo?.url ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewPhoto(item.photo.url)}
                            className="size-12 rounded-xl overflow-hidden border border-emerald-200 bg-gray-100 shrink-0 hover:opacity-90 transition-opacity"
                            title="Click to view photo"
                          >
                            <img
                              src={item.photo.url}
                              alt={matName}
                              className="size-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="size-12 rounded-xl bg-gray-100 text-gray-400 flex flex-col items-center justify-center shrink-0 border border-gray-200">
                            <Camera size={16} />
                            <span className="text-[8px] font-medium">No photo</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{matName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-gray-500">{kg} kg</span>
                            {item.photo?.url && (
                              <button
                                type="button"
                                onClick={() => setSelectedPreviewPhoto(item.photo.url)}
                                className="text-[11px] text-emerald-700 hover:underline font-medium"
                              >
                                View photo
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className="font-semibold text-slate-900 shrink-0">{money(val)}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Role-Based Action Controls */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-wrap gap-3">
              {/* Recycler Controls */}
              {user?.role === 'recycler' && (
                <>
                  {request.status === 'pending' && (
                    <>
                      <button
                        onClick={handleAccept}
                        disabled={actionLoading}
                        className="btn-primary"
                      >
                        {actionLoading ? (
                          <Loader2 size={16} className="animate-spin mr-2" />
                        ) : (
                          <Check size={16} className="mr-2" />
                        )}
                        Accept Request
                      </button>
                      <button
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionLoading}
                        className="btn-outline text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        <X size={16} className="mr-2" />
                        Reject Request
                      </button>
                    </>
                  )}

                  {request.status === 'accepted' && (
                    <button
                      onClick={() => setShowScheduleModal(true)}
                      disabled={actionLoading}
                      className="btn-primary"
                    >
                      <Calendar size={16} className="mr-2" />
                      Schedule Pickup
                    </button>
                  )}

                  {request.status === 'scheduled' && (
                    <button
                      onClick={handleMarkInTransit}
                      disabled={actionLoading}
                      className="btn-primary"
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <Truck size={16} className="mr-2" />
                      )}
                      Mark In Transit
                    </button>
                  )}

                  {request.status === 'in_transit' && (
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      disabled={actionLoading}
                      className="btn-primary"
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 size={16} className="mr-2" />
                      )}
                      Complete Handover
                    </button>
                  )}
                </>
              )}

              {/* Collector Controls */}
              {user?.role === 'collector' && (
                <>
                  {(request.status === 'pending' || request.status === 'accepted') && (
                    <button
                      onClick={handleCancel}
                      disabled={actionLoading}
                      className="btn-outline text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <XCircle size={16} className="mr-2" />
                      )}
                      Cancel Handover Request
                    </button>
                  )}

                  {request.status === 'scheduled' && (
                    <button
                      onClick={handleMarkInTransit}
                      disabled={actionLoading}
                      className="btn-primary"
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <Truck size={16} className="mr-2" />
                      )}
                      Confirm Material Dispatched / In Transit
                    </button>
                  )}

                  {request.status === 'in_transit' && (
                    <button
                      onClick={() => setShowCompleteModal(true)}
                      disabled={actionLoading}
                      className="btn-primary"
                    >
                      {actionLoading ? (
                        <Loader2 size={16} className="animate-spin mr-2" />
                      ) : (
                        <CheckCircle2 size={16} className="mr-2" />
                      )}
                      Confirm Delivery / Complete Handover
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right column: Status Timeline */}
          <div className="card p-7">
            <h3 className="font-bold mb-6 text-slate-900">Handover Lifecycle</h3>
            <Timeline status={request.status} />

            {request.status === 'completed' && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <Link
                  href={`/${recycler || user?.role === 'recycler' ? 'recycler' : 'collector'}/handover/${request.id}`}
                  className="btn-primary w-full justify-center"
                >
                  <FileText size={16} className="mr-2" />
                  View Digital Handover Record
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Reject Handover Request</h3>
            <p className="text-sm text-gray-500 mt-1">
              Please provide a reason so the collector knows why this request cannot be fulfilled.
            </p>
            <textarea
              className="form-input mt-4"
              rows={3}
              placeholder="e.g. Current facility capacity reached or material outside acceptance criteria."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-3 mt-6">
              <button
                className="btn-outline flex-1"
                onClick={() => setShowRejectModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 justify-center bg-rose-600 hover:bg-rose-700"
                onClick={handleReject}
                disabled={actionLoading}
              >
                {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Schedule Pickup Date</h3>
            <p className="text-sm text-gray-500 mt-1">
              Set the confirmed pickup or drop-off date for this handover.
            </p>
            <input
              type="date"
              className="form-input mt-4"
              value={scheduledDate}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
            <div className="flex gap-3 mt-6">
              <button
                className="btn-outline flex-1"
                onClick={() => setShowScheduleModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 justify-center"
                onClick={handleSchedule}
                disabled={actionLoading}
              >
                {actionLoading ? 'Scheduling...' : 'Confirm Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-900">Complete Handover</h3>
            <p className="text-sm text-gray-500 mt-1">
              Confirm that the materials have been verified, weighed, and received. This will generate your immutable Digital Handover Record and create the settlement transaction.
            </p>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs flex justify-between">
              <div>
                <p className="text-gray-400 font-semibold uppercase">Total Weight</p>
                <p className="font-bold text-slate-900 text-sm mt-0.5">{request.totalQuantityKg} kg</p>
              </div>
              <div className="text-right">
                <p className="text-gray-400 font-semibold uppercase">Settlement Value</p>
                <p className="font-bold text-emerald-700 text-sm mt-0.5">{money(request.estimatedValue)}</p>
              </div>
            </div>

            <textarea
              className="form-input mt-4"
              rows={3}
              placeholder="Add optional completion notes or physical weighbridge receipt number..."
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
            />

            <div className="flex gap-3 mt-6">
              <button
                className="btn-outline flex-1"
                onClick={() => setShowCompleteModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn-primary flex-1 justify-center"
                onClick={handleComplete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Completing...
                  </span>
                ) : (
                  'Confirm Completion'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Lightbox Photo Preview Modal */}
      {selectedPreviewPhoto && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-5 md:p-6 max-w-lg w-full shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-slate-900 text-base">E-Waste Item Photo</h3>
              <button
                type="button"
                onClick={() => setSelectedPreviewPhoto(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 rounded-2xl overflow-hidden border border-emerald-200 bg-slate-950/5 flex items-center justify-center max-h-96">
              <img
                src={selectedPreviewPhoto}
                alt="E-waste item preview"
                className="w-full max-h-96 object-contain"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button
                type="button"
                onClick={() => setSelectedPreviewPhoto(null)}
                className="btn-outline text-xs py-2 px-4"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  )
}

function Requests({ recycler = false }: { recycler?: boolean }) {
  const { user, isAuthenticated } = useAuth()
  const { requests: mockWorkflowRequests } = useWorkflow()
  const [realRequests, setRealRequests] = useState<HandoverRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isRecyclerRole = user?.role === 'recycler' || recycler

  const fetchRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isRecyclerRole) {
        const data = await requestsApi.getIncomingRequests()
        setRealRequests(data)
      } else {
        const data = await requestsApi.getMyRequests()
        setRealRequests(data)
      }
    } catch (err: any) {
      console.warn('Could not fetch requests from backend, falling back to workflow context:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchRequests()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, isRecyclerRole])

  return (
    <Shell recycler={isRecyclerRole}>
      <PageHeader
        title={isRecyclerRole ? 'Incoming Requests' : 'Handover Requests'}
        description="Track each request through the complete verified workflow."
        action={
          !isRecyclerRole ? (
            <Link href="/collector/add-waste" className="btn-primary">
              Add E-Waste
            </Link>
          ) : undefined
        }
      />
      <div className="container-app py-8 flex flex-col gap-4">
        {error && isAuthenticated && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchRequests} className="text-xs font-bold text-rose-700 underline">
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-gray-500 gap-2">
            <Loader2 className="animate-spin text-emerald-600" size={28} />
            <p className="text-sm">Loading handover requests...</p>
          </div>
        ) : isAuthenticated ? (
          realRequests.length > 0 ? (
            realRequests.map((req) => {
              const rec = typeof req.recyclerId === 'object' ? req.recyclerId : null
              const col = typeof req.collectorId === 'object' ? req.collectorId : null
              const counterparty = isRecyclerRole
                ? `From ${col?.name || 'Collector'}`
                : `To ${rec?.organizationName || rec?.businessName || 'Authorized Recycler'}`

              const itemsCount = Array.isArray(req.wasteItemIds) ? req.wasteItemIds.length : 1

              return (
                <Link
                  key={req.id}
                  href={`/${isRecyclerRole ? 'recycler' : 'collector'}/requests/${req.id}`}
                  className="card p-5 flex items-center justify-between gap-4 hover:border-emerald-300 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Package size={20} />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                        {req.totalQuantityKg} kg · {itemsCount} waste {itemsCount === 1 ? 'item' : 'items'}
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        {counterparty} · Est. {money(req.estimatedValue)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        Created {new Date(req.createdAt).toLocaleDateString('en-IN')}
                        {req.scheduledDate && ` · Scheduled ${req.scheduledDate.slice(0, 10)}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs uppercase font-bold px-3 py-1.5 rounded-full ${
                        req.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-800'
                          : req.status === 'accepted' || req.status === 'scheduled' || req.status === 'in_transit'
                          ? 'bg-sky-100 text-sky-800'
                          : req.status === 'rejected' || req.status === 'cancelled'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="card p-12 text-center">
              <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                <Package size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                {isRecyclerRole ? 'No incoming requests yet' : 'No handover requests found'}
              </h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                {isRecyclerRole
                  ? 'Requests submitted by collectors in your network will appear here for review and scheduling.'
                  : 'You have not created any handover requests yet. Select items from your inventory to initiate a request.'}
              </p>
              {!isRecyclerRole && (
                <Link href="/collector/add-waste" className="btn-primary mt-6 inline-flex">
                  Add E-Waste
                </Link>
              )}
            </div>
          )
        ) : (
          /* Fallback ONLY for unauthenticated demo state */
          mockWorkflowRequests.map((request) => (
            <Link
              key={request.id}
              href={`/${isRecyclerRole ? 'recycler' : 'collector'}/requests/${request.id}`}
              className="card p-5 flex items-center justify-between gap-4 hover:border-emerald-300 transition-all"
            >
              <div>
                <p className="font-bold text-slate-900">{request.material}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {isRecyclerRole
                    ? 'From Ravi Kumar'
                    : 'To ' +
                      (defaultMockRecyclers.find((item) => item.id === request.recyclerId)?.name ??
                        'Recycler')}{' '}
                  · {request.weight} kg · {money(request.estimatedValue)}
                </p>
              </div>
              <span className="status-completed">{request.status}</span>
            </Link>
          ))
        )}
      </div>
    </Shell>
  )
}

export function WorkflowRoute({ kind, id }: { kind: string; id?: string }) {
  if (kind === 'recycler-details') return <Shell><RecyclerDetails id={id ?? 'rec_001'} /></Shell>
  if (kind === 'collector-requests') return id ? <RequestDetails id={id} /> : <Requests />
  if (kind === 'recycler-requests') return id ? <RequestDetails id={id} recycler /> : <Requests recycler />
  if (kind === 'handover') return <Handover id={id ?? ''} />
  return null
}

function Handover({ id }: { id: string }) {
  const { user, isAuthenticated } = useAuth()
  const { getRequest } = useWorkflow()
  const [record, setRecord] = useState<HandoverRecordItem | null>(null)
  const [transaction, setTransaction] = useState<TransactionItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRecord = async () => {
    setLoading(true)
    setError(null)
    try {
      const rec = await handoversApi.getHandoverRecordById(id)
      setRecord(rec)
      try {
        const txn = await transactionsApi.getTransactionById(rec.id || id)
        setTransaction(txn)
      } catch {
        // Transaction lookup is secondary
      }
    } catch (err: any) {
      console.warn('Could not fetch real handover record:', err)
      setError(err.message || 'Handover record not found')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && id) {
      fetchRecord()
    } else {
      setLoading(false)
    }
  }, [id, isAuthenticated])

  const isRecyclerRole = user?.role === 'recycler'

  if (loading) {
    return (
      <Shell recycler={isRecyclerRole}>
        <div className="container-app py-20 flex flex-col items-center justify-center text-gray-500 gap-3">
          <Loader2 className="animate-spin text-emerald-600" size={32} />
          <p className="text-sm">Loading verified digital handover record...</p>
        </div>
      </Shell>
    )
  }

  if (isAuthenticated) {
    if (error || !record) {
      return (
        <Shell recycler={isRecyclerRole}>
          <PageHeader
            title="Digital Record Unavailable"
            description="The requested handover record could not be retrieved from the server."
          />
          <div className="container-app py-12 max-w-lg mx-auto text-center">
            <div className="card p-8">
              <AlertCircle className="size-12 text-rose-500 mx-auto mb-3" />
              <h2 className="text-xl font-bold text-slate-900">Record Not Found</h2>
              <p className="text-sm text-gray-500 mt-2">
                {error || 'No digital handover record exists for the provided reference.'}
              </p>
              <div className="flex justify-center gap-3 mt-6">
                <button onClick={fetchRecord} className="btn-outline">
                  Retry
                </button>
                <Link
                  href={isRecyclerRole ? '/recycler/requests' : '/collector/requests'}
                  className="btn-primary"
                >
                  Back to Requests
                </Link>
              </div>
            </div>
          </div>
        </Shell>
      )
    }

    const rec = typeof record.recyclerId === 'object' ? record.recyclerId : null
    const col = typeof record.collectorId === 'object' ? record.collectorId : null
    const recyclerName = rec?.organizationName || rec?.businessName || 'Authorized Recycler'
    const collectorName = col?.name || 'Collector'
    const itemsList = Array.isArray(record.wasteItemIds) ? (record.wasteItemIds as any[]) : []

    return (
      <Shell recycler={isRecyclerRole}>
        <PageHeader
          title="Digital Handover Record"
          description="A verified, immutable proof of completed e-waste material recovery."
        />
        <div className="container-app py-8">
          <Link
            href={isRecyclerRole ? '/recycler/requests' : '/collector/requests'}
            className="text-sm text-primary font-semibold inline-flex items-center gap-2 mb-6"
          >
            <ArrowLeft size={15} />
            Back to requests
          </Link>

          <div className="card p-8 max-w-3xl mx-auto border-t-4 border-emerald-500 shadow-xl">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div>
                <span className="text-xs uppercase tracking-widest text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full inline-block">
                  Verified Digital Handover Record
                </span>
                <h2 className="text-2xl font-extrabold mt-3 text-slate-900">
                  {record.handoverReference}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Permanent immutable platform verification certificate
                </p>
              </div>
              <div className="size-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-100">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Handover Reference</p>
                <p className="font-bold text-slate-900 mt-1 text-base">{record.handoverReference}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Completed Timestamp</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {new Date(record.completedAt).toLocaleString('en-IN')}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Collector</p>
                <p className="font-semibold text-slate-900 mt-1">{collectorName}</p>
                {col?.phone && <p className="text-xs text-gray-500">{col.phone}</p>}
                {col?.location && <p className="text-xs text-gray-500">{col.location}</p>}
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Authorized Recycler</p>
                <p className="font-semibold text-slate-900 mt-1">{recyclerName}</p>
                {rec?.registrationId && <p className="text-xs text-gray-500">Reg: {rec.registrationId}</p>}
                {rec?.location && <p className="text-xs text-gray-500">{rec.location}</p>}
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total Verified Weight</p>
                <p className="font-bold text-slate-900 mt-1 text-lg">{record.totalQuantityKg} kg</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Final Valuation</p>
                <p className="font-bold text-emerald-700 mt-1 text-lg">{money(record.finalValue)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Transaction Reference</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {transaction?.transactionReference || 'TXN-RECORDED'}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Settlement Status</p>
                <p className="font-semibold text-emerald-700 mt-1 flex items-center gap-1.5">
                  <ShieldCheck size={16} /> Completed (Simulated Settlement)
                </p>
              </div>

              {record.notes && (
                <div className="sm:col-span-2 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Completion Remarks</p>
                  <p className="text-sm text-gray-700 mt-1">{record.notes}</p>
                </div>
              )}
            </div>

            {/* Included Waste Items */}
            {itemsList.length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <h3 className="font-bold text-sm uppercase tracking-wide text-slate-900 mb-3">
                  Transferred E-Waste Items ({itemsList.length})
                </h3>
                <div className="space-y-2">
                  {itemsList.map((item, idx) => {
                    const mat = typeof item?.materialId === 'object' ? item.materialId : null
                    const matName = mat?.name || 'Electronic Waste'
                    const kg = item?.quantityKg || 0
                    const val = item?.estimatedValue || 0
                    return (
                      <div
                        key={item._id || item.id || idx}
                        className="p-3 bg-gray-50 rounded-xl flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-3">
                          <Package size={18} className="text-emerald-600" />
                          <div>
                            <p className="font-semibold text-slate-900">{matName}</p>
                            <p className="text-xs text-gray-500">{kg} kg · Status: Handed Over</p>
                          </div>
                        </div>
                        <span className="font-semibold text-emerald-700">{money(val)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-gray-100">
              <button className="btn-outline" onClick={() => window.print()}>
                Download / Print Record
              </button>
              <Link
                href={isRecyclerRole ? '/recycler/requests' : '/collector/requests'}
                className="btn-primary ml-auto"
              >
                Back to Requests
              </Link>
            </div>
          </div>
        </div>
      </Shell>
    )
  }

  // Fallback for unauthenticated demo view
  const mockReq = getRequest(id)
  const mockRec = defaultMockRecyclers.find((item) => item.id === mockReq?.recyclerId)

  if (!mockReq) {
    return (
      <Shell>
        <PageHeader
          title="Digital record unavailable"
          description="Choose a completed handover from requests."
        />
      </Shell>
    )
  }

  return (
    <Shell>
      <PageHeader
        title="Digital Handover Record"
        description="A verified record of your completed recycling handover."
      />
      <div className="container-app py-8">
        <div className="card p-8 max-w-3xl mx-auto border-t-4 border-emerald-500">
          <div className="flex justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest text-emerald-600 font-semibold">
                Verified digital record
              </p>
              <h2 className="text-2xl font-bold mt-2 text-slate-900">Successfully Handed Over</h2>
            </div>
            <CheckCircle2 className="text-emerald-600" size={38} />
          </div>

          <div className="grid sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-100">
            {[
              ['Handover ID', mockReq.id.toUpperCase()],
              ['Collector', 'Ravi Kumar'],
              ['Recycler', mockRec?.name ?? 'GreenCycle Recycling'],
              ['Material', mockReq.material],
              ['Weight', `${mockReq.weight} kg`],
              ['Estimated value', money(mockReq.estimatedValue)],
              ['Status', 'Completed'],
              [
                'Completion timestamp',
                mockReq.completedAt
                  ? new Date(mockReq.completedAt).toLocaleString('en-IN')
                  : 'Demo timestamp',
              ],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{l}</p>
                <p className="font-semibold mt-2 text-slate-900">{v}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-8">
            <button className="btn-outline" onClick={() => window.print()}>
              Download Record
            </button>
            <button className="btn-primary" onClick={() => window.print()}>
              Print Record
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
