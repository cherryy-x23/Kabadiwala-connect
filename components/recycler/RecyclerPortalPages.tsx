'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertCircle, BarChart3, Bell, Calendar, CheckCircle2, Clock3, Download, Filter, Package, Recycle, Search, Settings, ShieldCheck, Wallet, XCircle } from 'lucide-react'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import PageHeader from '@/components/layout/PageHeader'
import { MiniChart, DonutChart, StatCard } from '@/components/shared/DashboardWidgets'
import { useWorkflow, type WorkflowRequest } from '@/components/shared/WorkflowContext'
import { mockMaterials, mockRecyclers } from '@/data/mockData'

import { useAuth } from '@/lib/authContext'
import { requestsApi, HandoverRequestItem } from '@/lib/api/requests'
import { handoversApi, HandoverRecordItem } from '@/lib/api/handovers'
import { transactionsApi, TransactionItem } from '@/lib/api/transactions'
import { materialsApi } from '@/lib/api/materials'
import { useEffect } from 'react'

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
const recycler = mockRecyclers[0]
const statusClass = (status: string) => status === 'completed' ? 'status-completed' : status === 'rejected' ? 'status-rejected' : status === 'pending' ? 'status-pending' : 'status-accepted'

function RequestRow({ request, action }: { request: WorkflowRequest; action?: React.ReactNode }) {
  return <div className="card p-5"><div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div className="flex items-start gap-4"><div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Package size={20}/></div><div><p className="font-bold text-slate-900">{request.material}</p><p className="text-sm text-gray-500 mt-1">{request.id.toUpperCase()} · {request.weight} kg · {money(request.estimatedValue)}</p><p className="text-xs text-gray-400 mt-2">Collector: Ravi Kumar · Requested {request.createdDate}</p></div></div><div className="flex items-center gap-3 flex-wrap"><span className={statusClass(request.status)}>{request.status.replace('-', ' ')}</span><Link href={`/recycler/requests/${request.id}`} className="btn-ghost text-sm">View details</Link>{action}</div></div></div>
}

export function RecyclerAcceptedPage() {
  const { user, isAuthenticated } = useAuth()
  const { requests: mockWorkflowRequests } = useWorkflow()
  const [realRequests, setRealRequests] = useState<HandoverRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')

  const fetchRequests = () => {
    if (isAuthenticated && user?.role === 'recycler') {
      setLoading(true)
      setError(null)
      requestsApi.getIncomingRequests()
        .then((data) => {
          setRealRequests(data)
        })
        .catch((err) => {
          console.warn('Could not fetch real incoming requests:', err)
          setError(err.message || 'Failed to load accepted requests.')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [isAuthenticated, user?.role])

  const isReal = isAuthenticated && user?.role === 'recycler'
  const activeReal = realRequests.filter(r => ['accepted', 'scheduled', 'in_transit'].includes(r.status))
    .filter(r => status === 'all' || r.status === status)

  const activeMock = mockWorkflowRequests.filter(r => ['accepted','scheduled','in-transit'].includes(r.status))
    .filter(r => status === 'all' || r.status === status)
    .filter(r => r.material.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <PageHeader title="Accepted requests" description="Keep every active handover moving toward a scheduled pickup."/>
      <div className="container-app py-8">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
            <input className="form-input pl-10" placeholder="Search request" value={query} onChange={e=>setQuery(e.target.value)}/>
          </div>
          <select className="form-input md:w-48" value={status} onChange={e=>setStatus(e.target.value)}>
            <option value="all">All active</option>
            <option value="accepted">Accepted</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_transit">In transit</option>
          </select>
        </div>

        {error && isReal && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchRequests} className="text-xs font-bold text-rose-700 underline">
              Retry
            </button>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {loading ? (
            <div className="card p-10 text-center text-gray-500">Loading accepted requests...</div>
          ) : isReal ? (
            activeReal.length > 0 ? (
              activeReal.map(r => {
                const col = typeof r.collectorId === 'object' ? r.collectorId : null
                const collectorName = col?.name || 'Collector'
                return (
                  <div key={r.id} className="card p-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                          <Package size={20}/>
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{r.totalQuantityKg} kg Handover</p>
                          <p className="text-sm text-gray-500 mt-1">
                            ID: {r.id.slice(-6).toUpperCase()} · Est. {money(r.estimatedValue)}
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            Collector: {collectorName}
                            {r.scheduledDate && ` · Pickup Scheduled: ${r.scheduledDate.slice(0, 10)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`text-xs uppercase font-bold px-3 py-1 rounded-full ${
                          r.status === 'scheduled' ? 'bg-sky-100 text-sky-800' : r.status === 'in_transit' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {r.status.replace('_', ' ')}
                        </span>
                        <Link href={`/recycler/requests/${r.id}`} className="btn-primary text-xs py-1.5 px-3">
                          Manage Handover
                        </Link>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="card p-10 text-center text-gray-500">No accepted requests match your filters.</div>
            )
          ) : activeMock.length ? (
            activeMock.map(r => <RequestRow key={r.id} request={r}/>)
          ) : (
            <div className="card p-10 text-center text-gray-500">No accepted requests match your filters.</div>
          )}
        </div>
      </div>
    </>
  )
}

export function RecyclerCompletedPage() {
  const { user, isAuthenticated } = useAuth()
  const { requests, transactions } = useWorkflow()
  const [realHandovers, setRealHandovers] = useState<HandoverRecordItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCompleted = () => {
    if (isAuthenticated && user?.role === 'recycler') {
      setLoading(true)
      setError(null)
      handoversApi.getIncomingHandoverRecords()
        .then((data) => {
          setRealHandovers(data)
        })
        .catch((err) => {
          console.warn('Could not fetch real completed handover records:', err)
          setError(err.message || 'Failed to load completed handover records.')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompleted()
  }, [isAuthenticated, user?.role])

  const isReal = isAuthenticated && user?.role === 'recycler'
  const mockCompleted = requests.filter(r => r.status === 'completed')

  return (
    <>
      <PageHeader
        title="Completed handovers"
        description="A reliable archive of materials received, verified, and recorded."
      />
      <div className="container-app py-8">
        {error && isReal && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchCompleted} className="text-xs font-bold text-rose-700 underline">
              Retry
            </button>
          </div>
        )}

        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading completed handovers...</div>
          ) : isReal ? (
            realHandovers.length > 0 ? (
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Handover Ref', 'Collector', 'Items', 'Quantity', 'Completed Date', 'Final Value', 'Action'].map(x => (
                      <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {realHandovers.map(r => {
                    const col = typeof r.collectorId === 'object' ? r.collectorId : null
                    const collectorName = col?.name || 'Collector'
                    const itemsCount = Array.isArray(r.wasteItemIds) ? r.wasteItemIds.length : 1
                    const itemsSummary = `${itemsCount} item${itemsCount > 1 ? 's' : ''}`
                    const dateStr = r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-IN') : 'Recent'
                    const reqId = typeof r.handoverRequestId === 'object' ? (r.handoverRequestId as any)?.id || (r.handoverRequestId as any)?._id : r.handoverRequestId

                    return (
                      <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold text-slate-900 block">{r.handoverReference}</span>
                          <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">Digital Record</span>
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-800 font-medium">{collectorName}</td>
                        <td className="px-5 py-4 text-xs text-gray-600 max-w-[220px] truncate">{itemsSummary}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{r.totalQuantityKg} kg</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{dateStr}</td>
                        <td className="px-5 py-4 font-semibold text-slate-900">{money(r.finalValue)}</td>
                        <td className="px-5 py-4">
                          <Link className="text-primary text-sm font-semibold hover:underline" href={`/recycler/handover/${reqId || r.id}`}>
                            Digital Record
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-12 text-center text-gray-500">No completed handovers yet. Processed handovers will be recorded here.</p>
            )
          ) : (
            mockCompleted.length ? (
              <table className="w-full min-w-[800px] text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>{['Material','Collector','Quantity','Completed','Amount','Record'].map(x=><th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500">{x}</th>)}</tr>
                </thead>
                <tbody>
                  {mockCompleted.map(r => {
                    const t = transactions.find(x => x.requestId === r.id)
                    return (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-5 py-4 font-semibold">{r.material}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">Ravi Kumar</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{r.quantity} units · {r.weight} kg</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{r.completedAt?.slice(0,10) || r.createdDate}</td>
                        <td className="px-5 py-4 font-semibold">{money(t?.amount ?? r.estimatedValue)}</td>
                        <td className="px-5 py-4"><Link className="text-primary text-sm font-semibold" href={`/collector/handover/${r.id}`}>Digital record</Link></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-10 text-center text-gray-500">Completed handovers will appear here.</p>
            )
          )}
        </div>
      </div>
    </>
  )
}

export function RecyclerMaterialsPage() {
  const [materials, setMaterials] = useState<any[]>(mockMaterials)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    let mounted = true
    materialsApi.getMaterials()
      .then((data) => {
        if (mounted && data.length > 0) {
          setMaterials(data)
          setIsLive(true)
        }
      })
      .catch((err) => {
        console.warn('Could not load live materials for recycler portal:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <>
      <PageHeader
        title="Materials accepted"
        description="Indicative intake prices and processing capabilities for your facility."
      />
      <div className="container-app py-8">
        {isLive && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mb-4 w-fit">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Live authorized intake catalog ({materials.length} materials)
          </div>
        )}
        {loading ? (
          <div className="card p-12 text-center text-gray-400">Loading intake materials...</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {materials.map(m => (
              <div className="card p-6" key={m.id}>
                <div className="flex items-center justify-between">
                  <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Package size={21}/>
                  </div>
                  <span className="badge-success">Active Intake</span>
                </div>
                <h3 className="font-bold text-lg mt-5">{m.name}</h3>
                <p className="text-sm text-gray-500 mt-1">{m.category} · {m.unit}</p>
                <p className="text-2xl font-bold mt-5">
                  {money(m.indicativePrice)}
                  <span className="text-sm font-normal text-gray-500">/{m.unit.replace('per ','')}</span>
                </p>
                <p className="text-sm text-gray-600 mt-4">Processing: dismantling, sorting and material recovery</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

export function RecyclerTransactionsPage() {
  const { user, isAuthenticated } = useAuth()
  const { transactions: mockTransactionsList } = useWorkflow()
  const [realTransactions, setRealTransactions] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchTransactions = () => {
    if (isAuthenticated && user?.role === 'recycler') {
      setLoading(true)
      setError(null)
      transactionsApi.getIncomingTransactions()
        .then((data) => {
          setRealTransactions(data)
        })
        .catch((err) => {
          console.warn('Could not fetch real recycler transactions:', err)
          setError(err.message || 'Failed to load transaction history.')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactions()
  }, [isAuthenticated, user?.role])

  const isReal = isAuthenticated && user?.role === 'recycler'
  const filteredReal = realTransactions.filter(t => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const ref = (t.transactionReference || t.id).toLowerCase()
    const colName = typeof t.collectorId === 'object' ? (t.collectorId?.name || '').toLowerCase() : ''
    return ref.includes(term) || colName.includes(term)
  })

  return (
    <>
      <PageHeader
        title="Transaction history"
        description="Review simulated settlement records from completed handovers."
      />
      <div className="container-app py-8">
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-56">
            <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
            <input
              className="form-input pl-10"
              placeholder="Search by reference or collector..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
            Simulated Settlement
          </div>
        </div>

        {error && isReal && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={fetchTransactions} className="text-xs font-bold text-rose-700 underline">
              Retry
            </button>
          </div>
        )}

        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-500">Loading transactions...</div>
          ) : isReal ? (
            filteredReal.length > 0 ? (
              <table className="w-full min-w-[760px] text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Transaction Reference', 'Collector', 'Weight', 'Amount', 'Settlement Date', 'Payment Method', 'Status'].map(x => (
                      <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredReal.map(t => {
                    const col = typeof t.collectorId === 'object' ? t.collectorId : null
                    const collectorName = col?.name || 'Collector'
                    const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : 'Recent'
                    const handoverReqId = typeof t.handoverRequestId === 'object' ? (t.handoverRequestId as any)?.id || (t.handoverRequestId as any)?._id : t.handoverRequestId
                    const record = typeof t.handoverRecordId === 'object' ? (t.handoverRecordId as any) : null
                    const weightStr = record?.totalQuantityKg != null ? `${record.totalQuantityKg} kg` : '-'

                    return (
                      <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold text-slate-900 block">{t.transactionReference}</span>
                          {handoverReqId && (
                            <Link href={`/recycler/handover/${handoverReqId}`} className="text-xs text-primary hover:underline">
                              Digital Record
                            </Link>
                          )}
                        </td>
                        <td className="px-5 py-4 text-sm text-gray-700 font-medium">{collectorName}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{weightStr}</td>
                        <td className="px-5 py-4 text-sm font-semibold text-slate-900">{money(t.amount)}</td>
                        <td className="px-5 py-4 text-sm text-gray-600">{dateStr}</td>
                        <td className="px-5 py-4 text-xs">
                          <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-medium">
                            {t.paymentMethod.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-xs uppercase font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-12 text-center text-gray-500">No transactions match your search.</p>
            )
          ) : (
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>{['Transaction ID','Collector','Material','Amount','Date','Status'].map(x=><th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500">{x}</th>)}</tr>
              </thead>
              <tbody>
                {mockTransactionsList.map(t=>(
                  <tr key={t.id} className="border-b border-gray-100">
                    <td className="px-5 py-4 font-semibold">{t.id.toUpperCase()}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{t.collectorName}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{t.material}</td>
                    <td className="px-5 py-4 font-semibold">{money(t.amount)}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{t.date}</td>
                    <td className="px-5 py-4"><span className={statusClass(t.status)}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

export function RecyclerReportsPage() { const { requests, transactions } = useWorkflow(); const processed = requests.filter(r=>r.status==='completed').reduce((sum,r)=>sum+r.weight,0); const total = transactions.reduce((sum,t)=>sum+t.amount,0); return <><PageHeader title="Operations reports" description="A live prototype snapshot of GreenCycle Recycling performance."/><div className="container-app py-8"><div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5"><StatCard icon={Recycle} label="Total e-waste processed" value={`${(3420+processed).toLocaleString()} kg`} trend="8.4%"/><StatCard icon={CheckCircle2} label="Completed handovers" value={`${156+requests.filter(r=>r.status==='completed').length}`} tone="blue"/><StatCard icon={Wallet} label="Transaction summary" value={money(648000+total)} tone="violet"/><StatCard icon={BarChart3} label="This month" value="428 kg" tone="amber"/></div><div className="grid lg:grid-cols-3 gap-6 mt-6"><div className="card p-6 lg:col-span-2"><h2 className="font-bold text-lg">Monthly processing</h2><p className="text-sm text-gray-500 mt-1">Material received by month</p><MiniChart bars={[45,58,52,71,64,82,76]}/></div><div className="card p-6"><h2 className="font-bold text-lg">Material distribution</h2><DonutChart/></div></div><div className="card p-6 mt-6"><h2 className="font-bold text-lg">Report notes</h2><p className="text-sm text-gray-600 mt-2">Charts and totals are prototype insights based on shared workflow data. They can be connected to facility reporting APIs later.</p></div></div></> }

export function RecyclerNotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Request and handover updates for your recycling operations." />
      <div className="container-app py-8">
        <NotificationCenter role="recycler" />
      </div>
    </>
  )
}

export function RecyclerSettingsPage() { const [saved,setSaved]=useState(false); const [email,setEmail]=useState(true); const [requests,setRequests]=useState(true); return <><PageHeader title="Settings" description="Manage GreenCycle Recycling preferences and account security."/><div className="container-app py-8 max-w-3xl flex flex-col gap-6"><div className="card p-6"><div className="flex items-center gap-3"><Settings className="text-primary"/><div><h2 className="font-bold text-lg">Notification preferences</h2><p className="text-sm text-gray-500">Choose which operational updates you receive.</p></div></div><div className="flex flex-col gap-4 mt-6">{[[email,setEmail,'Email notifications','Receive handover and transaction updates'],[requests,setRequests,'Incoming request alerts','Get notified when collectors send requests']].map(([value,setter,label,desc])=><div key={label as string} className="flex justify-between items-center gap-4"><div><p className="font-medium">{label as string}</p><p className="text-sm text-gray-500">{desc as string}</p></div><button onClick={()=>{(setter as React.Dispatch<React.SetStateAction<boolean>>)(!(value as boolean));setSaved(false)}} className={`w-12 h-7 rounded-full p-1 ${value?'bg-emerald-600':'bg-gray-300'}`} aria-label={`Toggle ${label}`}><span className={`block size-5 rounded-full bg-white transition-transform ${value?'translate-x-5':''}`}/></button></div>)}</div></div><div className="card p-6"><h2 className="font-bold text-lg">Account security</h2><div className="grid sm:grid-cols-2 gap-4 mt-5"><label className="text-sm font-medium">Current password<input className="form-input mt-2" type="password" placeholder="••••••••"/></label><label className="text-sm font-medium">New password<input className="form-input mt-2" type="password" placeholder="Create a new password"/></label></div><button onClick={()=>setSaved(true)} className="btn-primary mt-6">{saved?'Preferences saved':'Save settings'}</button>{saved&&<p className="text-sm text-emerald-700 mt-3">Your prototype preferences have been saved.</p>}</div></div></> }
