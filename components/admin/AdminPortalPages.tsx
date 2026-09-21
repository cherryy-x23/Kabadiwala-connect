'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Activity, BarChart3, Bell, Building2, CheckCircle2, CircleDollarSign, Download, Filter, Lock, Plus, Recycle, Search, Settings, ShieldCheck, Users, Wallet, XCircle, AlertCircle } from 'lucide-react'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import PageHeader from '@/components/layout/PageHeader'
import { DonutChart, MiniChart, StatCard } from '@/components/shared/DashboardWidgets'
import { useWorkflow } from '@/components/shared/WorkflowContext'
import { mockCollectors, mockMaterials, mockNotifications, mockRecyclers } from '@/data/mockData'
import { materialsApi } from '@/lib/api/materials'
import { recyclersApi } from '@/lib/api/recyclers'

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`
const statusClass = (status: string) => status === 'completed' || status === 'verified' || status === 'active' ? 'status-completed' : status === 'rejected' || status === 'suspended' ? 'status-rejected' : 'status-pending'

function Toolbar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
        <input className="form-input pl-10" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}/>
      </div>
      <select className="form-input sm:w-44">
        <option>All statuses</option>
        <option>Active</option>
        <option>Pending</option>
        <option>Completed</option>
      </select>
      <button className="btn-outline">
        <Filter size={16} className="mr-2"/>Filters
      </button>
    </div>
  )
}

export function AdminDashboardPage() {
  const { requests, transactions } = useWorkflow()
  const [liveRecyclersCount, setLiveRecyclersCount] = useState<number | null>(null)
  const [liveMaterialsCount, setLiveMaterialsCount] = useState<number | null>(null)

  useEffect(() => {
    let mounted = true
    Promise.allSettled([recyclersApi.getRecyclers(), materialsApi.getMaterials()])
      .then(([recRes, matRes]) => {
        if (!mounted) return
        if (recRes.status === 'fulfilled') setLiveRecyclersCount(recRes.value.length)
        if (matRes.status === 'fulfilled') setLiveMaterialsCount(matRes.value.length)
      })
    return () => { mounted = false }
  }, [])

  const completed = requests.filter(r => r.status === 'completed')
  const totalWeight = requests.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.weight, 156400)
  const totalValue = transactions.reduce((sum, t) => sum + t.amount, 648000)

  return (
    <>
      <PageHeader title="Platform overview" description="Monitor activity across the Kabadiwala Connect ecosystem."/>
      <div className="container-app py-8">
        <div className="grid sm:grid-cols-2 xl:grid-cols-6 gap-4">
          <StatCard icon={Users} label="Total Collectors" value="1,200" trend="14.8%"/>
          <StatCard icon={Building2} label="Verified Recyclers" value={liveRecyclersCount !== null ? `${liveRecyclersCount}` : "35"} tone="blue"/>
          <StatCard icon={Recycle} label="E-Waste Collected" value={`${(totalWeight/1000).toFixed(1)}K kg`} trend="21.2%" tone="amber"/>
          <StatCard icon={CheckCircle2} label="Completed Handovers" value={`${4230 + completed.length}`} tone="violet"/>
          <StatCard icon={CircleDollarSign} label="Transaction Value" value={money(totalValue)} trend="18.4%"/>
          <StatCard icon={Activity} label="Pending Requests" value={`${requests.filter(r=>r.status==='pending').length}`} tone="amber"/>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-bold text-lg">E-waste collection over time</h2>
            <p className="text-sm text-gray-500 mt-1">Platform-wide monthly volume</p>
            <MiniChart bars={[40,52,48,61,70,78,89]}/>
          </div>
          <div className="card p-6">
            <h2 className="font-bold text-lg">Material distribution</h2>
            <DonutChart/>
            <div className="grid grid-cols-2 gap-3 mt-4 text-xs text-gray-500">
              <span>Computers 34%</span>
              <span>Phones 24%</span>
              <span>Cables 22%</span>
              <span>Batteries 20%</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mt-6">
          <div className="card p-6">
            <h2 className="font-bold text-lg">Recent platform activity</h2>
            <div className="flex flex-col gap-4 mt-5">
              {['New recycler profile submitted for review','Laptop Scrap handover completed','Transaction recorded for Mobile Phones','Collector Ravi Kumar updated a request'].map((x,i)=>(
                <div className="flex gap-3 items-start" key={x}>
                  <div className="size-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Activity size={15}/>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{x}</p>
                    <p className="text-xs text-gray-400 mt-1">September {19-i}, 2026</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Recent transactions</h2>
              <Link href="/admin/transactions" className="text-sm text-primary font-semibold">View all</Link>
            </div>
            <div className="flex flex-col gap-4 mt-5">
              {transactions.slice(0,4).map(t=>(
                <div className="flex items-center justify-between gap-3" key={t.id}>
                  <div>
                    <p className="text-sm font-semibold">{t.material}</p>
                    <p className="text-xs text-gray-500 mt-1">{t.recyclerName} · {t.date}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-600">{money(t.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function AdminCollectorsPage() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Record<string, boolean>>({ col_001: true })
  const rows = mockCollectors.filter(c => `${c.name} ${c.location} ${c.id}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <PageHeader title="Collector management" description="Review collector profiles and platform activity."/>
      <div className="container-app py-8">
        <Toolbar value={query} onChange={setQuery} placeholder="Search collectors..."/>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Collector ID','Name','Location','Phone','Collected','Handovers','Status','Actions'].map(x=>(
                  <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(c=>(
                <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 text-sm font-semibold">{c.id.toUpperCase()}</td>
                  <td className="px-5 py-4 text-sm font-semibold">{c.name}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{c.location}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{c.phone}</td>
                  <td className="px-5 py-4 text-sm">{c.totalCollected} kg</td>
                  <td className="px-5 py-4 text-sm">{c.completedHandovers}</td>
                  <td className="px-5 py-4">
                    <span className={statusClass(active[c.id] === false ? 'suspended' : 'active')}>
                      {active[c.id] === false ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-4 flex gap-1">
                    <button className="btn-ghost text-sm">View</button>
                    <button onClick={()=>setActive({...active,[c.id]: active[c.id] === false})} className="btn-ghost text-sm text-primary">
                      {active[c.id] === false ? 'Activate' : 'Suspend'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function AdminRecyclersPage() {
  const [query, setQuery] = useState('')
  const [recyclers, setRecyclers] = useState<any[]>(mockRecyclers)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)
  const [verified, setVerified] = useState<Record<string, boolean>>({ rec_001: true, rec_002: true, rec_003: true })

  useEffect(() => {
    let mounted = true
    recyclersApi.getRecyclers()
      .then((data) => {
        if (mounted && data.length > 0) {
          setRecyclers(data)
          setIsLive(true)
        }
      })
      .catch((err) => {
        console.warn('Could not load live recyclers, using directory data:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const rows = recyclers.filter(r => `${r.name || r.businessName} ${r.location || r.address}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <PageHeader title="Recycler management" description="Verify and monitor recycling partners on the platform."/>
      <div className="container-app py-8">
        {isLive && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mb-4 w-fit">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Live backend registry ({recyclers.length} facilities)
          </div>
        )}
        <Toolbar value={query} onChange={setQuery} placeholder="Search recyclers..."/>
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading facility partners...</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No recyclers match the search query.</div>
          ) : (
            <table className="w-full min-w-[900px] text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Recycler ID','Organization','Location','Materials','Status','Verification','Actions'].map(x=>(
                    <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-semibold">{r.registrationId || r.id.slice(-6).toUpperCase()}</td>
                    <td className="px-5 py-4 text-sm font-semibold">{r.name || r.businessName || r.organizationName}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{r.location || r.address || 'Hyderabad'}</td>
                    <td className="px-5 py-4 text-sm">{Array.isArray(r.acceptedMaterials) ? r.acceptedMaterials.length : 4}</td>
                    <td className="px-5 py-4"><span className="status-completed">Active</span></td>
                    <td className="px-5 py-4">
                      <span className={statusClass(verified[r.id] ?? true ? 'verified' : 'pending')}>
                        {verified[r.id] ?? true ? 'Verified on Platform' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-5 py-4 flex gap-1">
                      <Link href={`/recyclers/${r.id}`} className="btn-ghost text-sm">View</Link>
                      <button onClick={()=>setVerified(prev => ({...prev, [r.id]: !(prev[r.id] ?? true)}))} className="btn-ghost text-sm text-primary">
                        {verified[r.id] ?? true ? 'Suspend' : 'Verify'}
                      </button>
                    </td>
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

export function AdminMaterialsPage() {
  const [query, setQuery] = useState('')
  const [show, setShow] = useState(false)
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
        console.warn('Could not load live materials catalog:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  const list = materials.filter(m => `${m.name} ${m.category}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <PageHeader
        title="Material management"
        description="Keep indicative material pricing and intake categories current."
        action={
          <button onClick={()=>setShow(true)} className="btn-primary">
            <Plus size={17} className="mr-2"/>Add material
          </button>
        }
      />
      <div className="container-app py-8">
        {isLive && (
          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mb-4 w-fit">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            Live backend catalog ({materials.length} active materials)
          </div>
        )}
        <Toolbar value={query} onChange={setQuery} placeholder="Search materials..."/>
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading materials catalog...</div>
          ) : list.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No materials match your query.</div>
          ) : (
            <table className="w-full min-w-[800px] text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {['Material','Category','Indicative price','Unit','Recyclers','Status','Actions'].map(x=>(
                    <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map(m=>(
                  <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-4 font-semibold text-slate-900">{m.name}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{m.category}</td>
                    <td className="px-5 py-4 text-sm font-medium">{money(m.indicativePrice)}</td>
                    <td className="px-5 py-4 text-sm text-gray-600">{m.unit}</td>
                    <td className="px-5 py-4 text-sm">{m.acceptedByRecyclers ?? 12}</td>
                    <td className="px-5 py-4"><span className="status-completed">Active</span></td>
                    <td className="px-5 py-4">
                      <button className="btn-ghost text-sm">Edit</button>
                      <button className="btn-ghost text-sm text-red-600">Deactivate</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {show && (
        <div className="fixed inset-0 bg-slate-950/40 flex items-center justify-center p-4 z-50">
          <div className="card p-6 w-full max-w-md bg-white shadow-2xl">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-lg">Add Material</h2>
              <button onClick={()=>setShow(false)} className="btn-ghost p-1.5">Close</button>
            </div>
            <div className="flex flex-col gap-4 mt-6">
              <label className="text-xs font-semibold text-gray-600">Material Name
                <input className="form-input mt-1" placeholder="e.g. Copper Wire Grade A"/>
              </label>
              <label className="text-xs font-semibold text-gray-600">Category
                <input className="form-input mt-1" placeholder="e.g. Cables"/>
              </label>
              <label className="text-xs font-semibold text-gray-600">Indicative Price (₹/kg)
                <input className="form-input mt-1" placeholder="e.g. 550"/>
              </label>
            </div>
            <button onClick={()=>setShow(false)} className="btn-primary mt-6 w-full">Save material</button>
          </div>
        </div>
      )}
    </>
  )
}

export function AdminRequestsPage() {
  const { requests } = useWorkflow()
  const [filter, setFilter] = useState('All')
  const list = filter === 'All' ? requests : requests.filter(r => r.status === filter.toLowerCase().replace(' ', '-'))

  return (
    <>
      <PageHeader title="Request monitoring" description="Track every handover across the shared workflow."/>
      <div className="container-app py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {['All','Pending','Accepted','Scheduled','In Transit','Completed','Rejected'].map(x=>(
            <button
              key={x}
              onClick={()=>setFilter(x)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter===x ? 'bg-slate-950 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {x}
            </button>
          ))}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Request ID','Collector','Recycler','Material','Quantity','Value','Date','Status'].map(x=>(
                  <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(r=>(
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 font-semibold">
                    <Link className="text-primary hover:underline" href={`/collector/requests/${r.id}`}>{r.id.toUpperCase()}</Link>
                  </td>
                  <td className="px-5 py-4 text-sm font-medium">Ravi Kumar</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{mockRecyclers.find(x=>x.id===r.recyclerId)?.name || 'GreenCycle Recycling'}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{r.material}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{r.quantity} / {r.weight} kg</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{money(r.estimatedValue)}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">{r.createdDate}</td>
                  <td className="px-5 py-4">
                    <span className={statusClass(r.status)}>{r.status.replace('-', ' ')}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function AdminTransactionsPage() {
  const { transactions } = useWorkflow()
  const [query, setQuery] = useState('')
  const list = transactions.filter(t => `${t.id} ${t.material} ${t.recyclerName}`.toLowerCase().includes(query.toLowerCase()))

  return (
    <>
      <PageHeader title="Transaction monitoring" description="Review prototype settlement records across the platform."/>
      <div className="container-app py-8">
        <div className="grid sm:grid-cols-3 gap-5 mb-6">
          <StatCard icon={CircleDollarSign} label="Total value" value={money(transactions.reduce((s,t)=>s+t.amount,648000))}/>
          <StatCard icon={CheckCircle2} label="Completed" value={`${transactions.filter(t=>t.status==='completed').length}`} tone="blue"/>
          <StatCard icon={Wallet} label="Average value" value={money(Math.round(transactions.reduce((s,t)=>s+t.amount,0)/Math.max(transactions.length,1)))} tone="violet"/>
        </div>
        <Toolbar value={query} onChange={setQuery} placeholder="Search transaction records..."/>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Transaction ID','Collector','Recycler','Material','Weight','Amount','Date','Status'].map(x=>(
                  <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(t=>(
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 font-semibold text-slate-900">{t.id.toUpperCase()}</td>
                  <td className="px-5 py-4 text-sm text-gray-700">{t.collectorName}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.recyclerName}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.material}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.weight} kg</td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{money(t.amount)}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">{t.date}</td>
                  <td className="px-5 py-4"><span className={statusClass(t.status)}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export function AdminReportsPage() {
  const { requests, transactions } = useWorkflow()
  const completed = requests.filter(r=>r.status==='completed')

  return (
    <>
      <PageHeader title="Platform reports" description="Analytics for collection, handovers and transaction activity."/>
      <div className="container-app py-8">
        <div className="flex justify-end mb-5">
          <select className="form-input w-44">
            <option>Last 6 months</option>
            <option>This year</option>
            <option>All time</option>
          </select>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard icon={Recycle} label="E-waste collected" value="156.4K kg" trend="21.2%"/>
          <StatCard icon={Users} label="Active collectors" value="1,108" tone="blue"/>
          <StatCard icon={Building2} label="Active recyclers" value="35" tone="amber"/>
          <StatCard icon={CheckCircle2} label="Completed handovers" value={`${4230+completed.length}`} tone="violet"/>
        </div>
        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="card p-6 lg:col-span-2">
            <h2 className="font-bold text-lg">Monthly collection</h2>
            <p className="text-sm text-gray-500 mt-1">Weight processed by month</p>
            <MiniChart bars={[42,55,51,68,74,81,92]}/>
          </div>
          <div className="card p-6">
            <h2 className="font-bold text-lg">Material distribution</h2>
            <DonutChart/>
          </div>
        </div>
        <div className="card p-6 mt-6">
          <h2 className="font-bold text-lg">Transaction volume</h2>
          <p className="text-sm text-gray-500 mt-1">{transactions.length} shared workflow records currently visible</p>
          <MiniChart bars={[32,48,44,61,58,76,82]}/>
        </div>
      </div>
    </>
  )
}

export function AdminNotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Platform registrations, handovers and transaction updates." />
      <div className="container-app py-8">
        <NotificationCenter role="admin" />
      </div>
    </>
  )
}

export function AdminSettingsPage() {
  const [saved, setSaved] = useState(false)

  return (
    <>
      <PageHeader title="Admin settings" description="Manage platform administration preferences."/>
      <div className="container-app py-8 max-w-3xl flex flex-col gap-6">
        <div className="card p-6">
          <h2 className="font-bold text-lg">Admin profile</h2>
          <div className="grid sm:grid-cols-2 gap-4 mt-5">
            <label className="text-sm font-medium">Name
              <input className="form-input mt-2" defaultValue="Platform Admin" readOnly/>
            </label>
            <label className="text-sm font-medium">Email
              <input className="form-input mt-2" defaultValue="admin@demo.com" readOnly/>
            </label>
          </div>
        </div>
        <div className="card p-6">
          <h2 className="font-bold text-lg">Preferences</h2>
          <div className="flex flex-col gap-4 mt-5">
            {['Platform activity notifications','New verification alerts','Weekly analytics summary'].map(x=>(
              <label key={x} className="flex items-center justify-between text-sm">
                <span>{x}</span>
                <input type="checkbox" defaultChecked className="size-4 accent-emerald-600"/>
              </label>
            ))}
          </div>
        </div>
        <div className="card p-6">
          <div className="flex items-center gap-2">
            <Lock className="text-primary" size={19}/>
            <h2 className="font-bold text-lg">Security & Authentication</h2>
          </div>
          <p className="text-xs text-gray-500 mt-2">All administrative access is secured via HttpOnly JWT session cookies.</p>
          <input className="form-input mt-4" type="password" placeholder="New administrator password"/>
          <button onClick={()=>setSaved(true)} className="btn-primary mt-5">
            {saved ? 'Settings saved' : 'Save changes'}
          </button>
        </div>
      </div>
    </>
  )
}

export function AdminProfilePlaceholder() { return <AdminSettingsPage/> }
