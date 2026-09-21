'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, Award, BarChart3, Bell, Building2, Calendar, Camera, Check, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, Clock3, FileText, Filter, Headphones, HelpCircle, Home, ImagePlus, Leaf, LineChart, ListChecks, Lock, LogOut, Mail, MapPin, Menu, MessageCircle, Package, Pencil, Phone, Plus, Recycle, Search, Send, Settings, ShieldCheck, ShoppingBag, Sparkles, Star, Tag, TrendingUp, Truck, Upload, User, Users, Wallet, X, Zap, Bot, Monitor, Smartphone, Battery, Cable, Tv, Printer, WashingMachine, ChevronLeft
} from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import DashboardLayout from '@/components/layout/DashboardLayout'
import PageHeader from '@/components/layout/PageHeader'
import { mockDashboardStats, mockMaterials, mockNotifications, mockRecentActivity, mockRecyclers, mockRequests, mockTransactions, WasteRequest, Material } from '@/data/mockData'
import { DonutChart, MiniChart, StatCard } from '@/components/shared/DashboardWidgets'
import { WorkflowRoute } from '@/components/workflow/CoreWorkflow'
import { RecyclerAcceptedPage, RecyclerCompletedPage, RecyclerMaterialsPage, RecyclerTransactionsPage, RecyclerReportsPage, RecyclerNotificationsPage, RecyclerSettingsPage } from '@/components/recycler/RecyclerPortalPages'
import { AdminDashboardPage, AdminCollectorsPage, AdminRecyclersPage, AdminMaterialsPage, AdminRequestsPage, AdminTransactionsPage, AdminReportsPage, AdminNotificationsPage, AdminSettingsPage } from '@/components/admin/AdminPortalPages'
import { useAuth } from '@/lib/authContext'
import { materialsApi } from '@/lib/api/materials'
import { recyclersApi } from '@/lib/api/recyclers'
import { wasteApi, WasteItem } from '@/lib/api/waste'
import { requestsApi, HandoverRequestItem } from '@/lib/api/requests'
import { transactionsApi, TransactionItem } from '@/lib/api/transactions'
import { handoversApi, HandoverRecordItem } from '@/lib/api/handovers'
import NotificationCenter from '@/components/notifications/NotificationCenter'
import KabiAIView from '@/components/ai/KabiAIView'
import RecyclerDiscovery from '@/components/discovery/RecyclerDiscovery'
import RecyclerLocationManager from '@/components/recycler/RecyclerLocationManager'

const money = (n: number) => `₹${n.toLocaleString('en-IN')}`

function PublicShell({ children }: { children: React.ReactNode }) { return <><Navbar />{children}</> }

function HomePage() {
  return <PublicShell><main className="bg-white"><section className="relative overflow-hidden pt-16 md:pt-24 pb-20 bg-gradient-to-br from-emerald-50 via-white to-sky-50"><div className="container-app grid lg:grid-cols-2 gap-14 items-center"><div><span className="badge-primary mb-5">Smart India Hackathon prototype</span><h1 className="text-5xl md:text-6xl font-bold tracking-tight text-slate-950 leading-[1.05]">Connecting kabadiwalas to a <span className="text-primary">smarter recycling future.</span></h1><p className="text-lg text-slate-600 mt-6 max-w-xl leading-relaxed">Bringing informal e-waste collectors closer to the formal recycling ecosystem through technology, transparency and intelligent connections.</p><div className="flex flex-wrap gap-3 mt-8"><Link href="/register?role=collector" className="btn-primary">Join as Collector <ArrowRight className="ml-2" size={18}/></Link><Link href="/recyclers" className="btn-outline">Find a Recycler</Link></div><div className="flex items-center gap-4 mt-8 text-sm text-slate-500"><div className="flex -space-x-2">{['R','A','S','M'].map((x,i)=><div key={i} className="size-8 rounded-full bg-emerald-100 border-2 border-white flex items-center justify-center text-xs font-semibold text-emerald-700">{x}</div>)}</div><span>Join 1,200+ collectors building a cleaner tomorrow</span></div></div><div className="relative"><div className="absolute inset-4 rounded-[2rem] bg-emerald-200/30 blur-3xl"/><div className="relative card-lg p-6 md:p-8 bg-white/90"><div className="flex items-center justify-between mb-8"><div><p className="text-xs uppercase tracking-[0.2em] text-gray-400">Network flow</p><p className="font-semibold text-slate-900 mt-1">From collection to impact</p></div><div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Activity size={20}/></div></div><div className="grid grid-cols-4 gap-2 items-center">{[{icon: Leaf,label:'Collect',color:'bg-emerald-50 text-emerald-600'},{icon: GlobeIcon,label:'Connect',color:'bg-sky-50 text-sky-600'},{icon: Truck,label:'Handover',color:'bg-amber-50 text-amber-600'},{icon: Recycle,label:'Recycle',color:'bg-violet-50 text-violet-600'}].map((s,i)=><div key={s.label} className="contents"><div className="text-center"><div className={`size-14 mx-auto rounded-2xl ${s.color} flex items-center justify-center`}><s.icon size={25}/></div><p className="text-xs font-semibold text-slate-700 mt-3">{s.label}</p></div>{i<3&&<ArrowRight className="text-gray-300 mx-auto" size={18}/>}</div>)}</div><div className="mt-9 rounded-2xl bg-slate-950 text-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs text-slate-400">This month</p><p className="text-2xl font-bold mt-1">₹2.4L <span className="text-xs font-medium text-emerald-400">+18.6%</span></p></div><LineChart className="text-emerald-400" size={28}/></div><div className="flex items-end gap-1.5 h-12 mt-4">{[22,35,27,42,31,48,40,54,44,62,56,72].map((h,i)=><div key={i} className="flex-1 bg-emerald-400/70 rounded-t-sm" style={{height:`${h}%`}}/>)}</div></div></div></div></div></section><section className="py-20 bg-white"><div className="container-app"><div className="max-w-2xl"><span className="badge-primary">The opportunity</span><h2 className="section-header mt-4">Formal recycling starts with a better connection.</h2><p className="text-lg text-gray-600 leading-relaxed">Informal collectors are the backbone of India&apos;s e-waste collection network. Kabadiwala Connect helps them access authorized recyclers, transparent prices, digital records and fairer outcomes.</p></div><div className="grid md:grid-cols-3 gap-5 mt-12">{[{icon:Users,title:'Collector network',text:'Give every collector a verified digital identity and a clear path into the formal ecosystem.'},{icon:Tag,title:'Transparent pricing',text:'Make indicative material prices visible so every handover starts with shared expectations.'},{icon:FileText,title:'Proof of impact',text:'Create a digital record for every handover, payment and kilogram responsibly processed.'}].map((x)=><div key={x.title} className="card p-7"><div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><x.icon size={22}/></div><h3 className="font-semibold text-lg text-slate-900 mt-5">{x.title}</h3><p className="text-gray-600 mt-2 leading-relaxed">{x.text}</p></div>)}</div></div></section><section className="py-20 bg-slate-950 text-white"><div className="container-app"><div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5"><div><span className="text-emerald-400 text-sm font-semibold">Built for measurable change</span><h2 className="text-3xl md:text-4xl font-bold mt-2">A network that makes every handover count.</h2></div><Link href="/how-it-works" className="text-emerald-400 font-semibold flex items-center gap-2">See how it works <ArrowRight size={17}/></Link></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">{[['156.4K+','kg collected'],['1,200+','collectors'],['35+','recycling partners'],['₹24.6L+','value processed']].map(([v,l])=><div key={l} className="border border-slate-700 rounded-2xl p-6"><p className="text-3xl font-bold text-emerald-400">{v}</p><p className="text-slate-400 mt-2">{l}</p><p className="text-xs text-slate-500 mt-5">Prototype metric</p></div>)}</div></div></section><section className="py-20"><div className="container-app text-center"><span className="badge-primary">Start today</span><h2 className="section-header mt-4">Join the recycling network</h2><p className="text-lg text-gray-600 max-w-xl mx-auto">Whether you collect, recycle, or enable the ecosystem, there&apos;s a place for you here.</p><div className="flex flex-wrap justify-center gap-3 mt-8"><Link href="/register?role=collector" className="btn-primary">Register as Collector</Link><Link href="/register?role=recycler" className="btn-secondary">Register as Recycler</Link></div></div></section></main><PublicFooter/></PublicShell>
}

function GlobeIcon({size}: {size?: number}) { return <Globe size={size}/> }
function PublicFooter(){return <footer className="bg-slate-950 text-white py-14"><div className="container-app grid md:grid-cols-4 gap-10"><div className="md:col-span-2"><div className="flex items-center gap-2 font-bold text-xl"><Leaf className="text-emerald-400" size={22}/>Kabadiwala Connect</div><p className="text-slate-400 max-w-sm mt-4">Connecting people, materials and responsible recycling through technology.</p></div>{[['Platform',['How it works','Materials','Recyclers']],['Company',['About','Contact','Future scope']]].map(([h,links])=><div key={h as string}><p className="font-semibold">{h as string}</p><div className="flex flex-col gap-3 mt-4">{(links as string[]).map(x=><Link key={x} href={`/${x.toLowerCase().replaceAll(' ','-')}`} className="text-sm text-slate-400 hover:text-white">{x}</Link>)}</div></div>)}</div><div className="container-app border-t border-slate-800 mt-12 pt-6 text-xs text-slate-500">© 2026 Kabadiwala Connect · Smart India Hackathon prototype · Demo data only</div></footer>}

function PublicPage({ type }: { type: string }) { const content: Record<string,{title:string;desc:string}>={about:{title:'About Kabadiwala Connect',desc:'A digital bridge between informal collectors and the formal e-waste recycling ecosystem.'},'how-it-works':{title:'How it works',desc:'A simple, transparent journey from collection to responsible recycling.'},materials:{title:'E-waste materials',desc:'Explore indicative prices and understand what each material can become.'},recyclers:{title:'Find an authorized recycler',desc:'Discover verified partners near you who accept your materials.'},contact:{title:'Let’s build a cleaner future',desc:'Have a question, partnership idea, or feedback? We’d love to hear from you.'}}; const c=content[type]||content.about; return <PublicShell><PageHeader title={c.title} description={c.desc}/><div className="container-app py-12">{type==='recyclers'?<RecyclerDirectory/>:type==='materials'?<MaterialsGrid/>:<div className="max-w-4xl mx-auto"><div className="card p-8 md:p-12"><div className="prose max-w-none"><h2 className="text-2xl font-bold text-slate-900">{type==='how-it-works'?'The complete journey':'Technology with a human purpose'}</h2><p className="text-gray-600 leading-relaxed mt-4">Kabadiwala Connect makes the informal e-waste collection economy more visible, connected and rewarding. Collectors can register, add materials, discover verified recyclers, request handovers and keep a digital record of every transaction.</p><div className="grid md:grid-cols-4 gap-4 mt-10">{['Register','Add e-waste','Find recycler','Get rewarded'].map((x,i)=><div key={x} className="rounded-2xl bg-emerald-50 p-5"><div className="size-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold">{i+1}</div><p className="font-semibold mt-4">{x}</p></div>)}</div><h3 className="text-xl font-bold text-slate-900 mt-12">Future scope</h3><p className="text-gray-600 leading-relaxed mt-3">Municipal ecosystem integration, government and EPR systems, WhatsApp access, smart IoT collection bins, advanced AI-based classification, expansion beyond e-waste, real-time pricing and a dedicated mobile app are intentionally reserved for future phases.</p></div></div></div>}</div><PublicFooter/></PublicShell> }

function RecyclerDirectory() {
  const [recyclers, setRecyclers] = useState<typeof mockRecyclers>(mockRecyclers)
  const [loading, setLoading] = useState(true)
  const [isLive, setIsLive] = useState(false)

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
        console.warn('Could not fetch recyclers from backend, using default directory:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      {isLive && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mb-4 w-fit">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Live backend directory ({recyclers.length} verified facilities)
        </div>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        {recyclers.map((r) => (
          <div key={r.id} className="card p-6">
            <div className="flex justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">{r.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <MapPin size={14} />{r.location}
                  </p>
                </div>
              </div>
              <span className="badge-success">
                <ShieldCheck size={14} className="mr-1" />Verified
              </span>
            </div>
            <div className="flex items-center gap-4 mt-6 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Star size={15} className="text-amber-500 fill-amber-500" />{r.rating}
              </span>
              <span>{r.distance} km away</span>
              <span>{r.operatingHours}</span>
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              {r.acceptedMaterials.map((x) => (
                <span key={x} className="px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-600">
                  {x}
                </span>
              ))}
            </div>
            <Link href={`/recyclers/${r.id}`} className="btn-outline mt-6 w-full">
              View details <ArrowRight size={16} className="ml-2" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

function MaterialsGrid() {
  const [materials, setMaterials] = useState<typeof mockMaterials>(mockMaterials)
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
        console.warn('Could not fetch materials from backend, using default catalog:', err)
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => { mounted = false }
  }, [])

  return (
    <div>
      {isLive && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg mb-4 w-fit">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          Live backend catalog ({materials.length} materials)
        </div>
      )}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {materials.map((m) => (
          <div key={m.id} className="card p-6">
            <div className="flex items-start justify-between">
              <div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Recycle size={21} />
              </div>
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                {m.priceTrend === 'up' ? <ArrowUpRight size={13} /> : m.priceTrend === 'down' ? <ArrowDownRight size={13} /> : <Activity size={13} />} {m.priceTrend}
              </span>
            </div>
            <h3 className="font-bold text-slate-900 mt-5">{m.name}</h3>
            <p className="text-sm text-gray-500 mt-1">{m.category}</p>
            <div className="flex items-end justify-between mt-6">
              <p className="text-2xl font-bold text-slate-900">
                ₹{m.indicativePrice}
                <span className="text-sm font-normal text-gray-500">/{m.unit.replace('per ', '')}</span>
              </p>
              <span className="text-xs text-gray-500">{m.acceptedByRecyclers} partners</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const collectorNav = [{icon:Home,label:'Dashboard',href:'/collector/dashboard'},{icon:Plus,label:'Add E-Waste',href:'/collector/add-waste'},{icon:Package,label:'Waste Inventory',href:'/collector/inventory'},{icon:Tag,label:'Materials & Prices',href:'/collector/materials'},{icon:Search,label:'Find Recyclers',href:'/collector/recyclers'},{icon:ListChecks,label:'Handover Requests',href:'/collector/requests'},{icon:Wallet,label:'Transactions',href:'/collector/transactions'},{icon:TrendingUp,label:'Earnings',href:'/collector/earnings'},{icon:Bot,label:'AI Assistant',href:'/collector/ai-assistant'},{icon:Bell,label:'Notifications',href:'/collector/notifications'},{icon:User,label:'Profile',href:'/collector/profile'},{icon:Settings,label:'Settings',href:'/collector/settings'}]
const recyclerNav = [{icon:Home,label:'Dashboard',href:'/recycler/dashboard'},{icon:Mail,label:'Incoming Requests',href:'/recycler/requests'},{icon:CheckCircle2,label:'Accepted Requests',href:'/recycler/accepted'},{icon:Recycle,label:'Completed Handovers',href:'/recycler/completed'},{icon:Tag,label:'Materials',href:'/recycler/materials'},{icon:Wallet,label:'Transactions',href:'/recycler/transactions'},{icon:BarChart3,label:'Reports',href:'/recycler/reports'},{icon:MapPin,label:'Facility Location',href:'/recycler/location'},{icon:User,label:'Profile',href:'/recycler/profile'},{icon:Bell,label:'Notifications',href:'/recycler/notifications'},{icon:Settings,label:'Settings',href:'/recycler/settings'}]
const adminNav = [{icon:Home,label:'Dashboard',href:'/admin/dashboard'},{icon:Users,label:'Collectors',href:'/admin/collectors'},{icon:Building2,label:'Recyclers',href:'/admin/recyclers'},{icon:Tag,label:'Materials',href:'/admin/materials'},{icon:ListChecks,label:'Handover Requests',href:'/admin/requests'},{icon:Wallet,label:'Transactions',href:'/admin/transactions'},{icon:BarChart3,label:'Reports',href:'/admin/reports'},{icon:Bell,label:'Notifications',href:'/admin/notifications'},{icon:Settings,label:'Settings',href:'/admin/settings'}]

function DashboardShell({ role, children }: {role:'collector'|'recycler'|'admin';children:React.ReactNode}) {
  const { user } = useAuth()
  const activeRole = (user?.role as 'collector'|'recycler'|'admin') || role
  const nav = activeRole === 'collector' ? collectorNav : activeRole === 'recycler' ? recyclerNav : adminNav
  const defaultName = activeRole === 'collector' ? 'Ravi Kumar' : activeRole === 'recycler' ? 'GreenCycle Recycling' : 'Platform Admin'
  const name = user?.name || defaultName

  return <DashboardLayout items={nav} userRole={activeRole} userName={name}>{children}</DashboardLayout>
}

function CollectorDashboard(){
  const { user, isAuthenticated } = useAuth()
  const [wasteItems, setWasteItems] = useState<WasteItem[]>([])
  const [requests, setRequests] = useState<HandoverRequestItem[]>([])
  const [liveRecyclers, setLiveRecyclers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    if (isAuthenticated && user?.role === 'collector') {
      Promise.allSettled([
        wasteApi.getMyWasteItems(),
        requestsApi.getMyRequests(),
        recyclersApi.getRecyclers()
      ])
        .then(([wasteRes, reqRes, recRes]) => {
          if (!mounted) return
          if (wasteRes.status === 'fulfilled') setWasteItems(wasteRes.value)
          if (reqRes.status === 'fulfilled') setRequests(reqRes.value)
          if (recRes.status === 'fulfilled') setLiveRecyclers(recRes.value)
        })
        .finally(() => {
          if (mounted) setLoading(false)
        })
    } else {
      setLoading(false)
    }
    return () => { mounted = false }
  }, [isAuthenticated, user?.role])

  const isReal = isAuthenticated && user?.role === 'collector'
  const totalKg = wasteItems.reduce((sum, w) => sum + w.quantityKg, 0)
  const availableKg = wasteItems.filter(w => w.status === 'available').reduce((sum, w) => sum + w.quantityKg, 0)
  const pendingRequests = requests.filter(r => r.status === 'pending').length
  const completedHandovers = requests.filter(r => r.status === 'completed').length

  const displayName = user?.name || 'Ravi'
  const displayRecyclers = (liveRecyclers.length > 0 ? liveRecyclers : mockRecyclers).slice(0, 2)

  return (
    <DashboardShell role="collector">
      <PageHeader
        title={`Good morning, ${displayName}`}
        description="Here's your verified e-waste collection activity."
        action={
          <Link href="/collector/add-waste" className="btn-primary">
            <Plus size={18} className="mr-2"/>Add e-waste
          </Link>
        }
      />
      <div className="container-app py-8">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard
            icon={Recycle}
            label="Total Inventory"
            value={isReal ? `${totalKg} kg` : "1,284 kg"}
            trend={isReal ? "Verified" : "Active"}
          />
          <StatCard
            icon={Clock3}
            label="Pending Requests"
            value={isReal ? `${pendingRequests}` : "4"}
            tone="amber"
          />
          <StatCard
            icon={CheckCircle2}
            label="Completed Handovers"
            value={isReal ? `${completedHandovers}` : "27"}
            trend={isReal ? "Recorded" : "Verified"}
            tone="blue"
          />
          <StatCard
            icon={Package}
            label="Available For Handover"
            value={isReal ? `${availableKg} kg` : "420 kg"}
            tone="violet"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg text-slate-900">Collection overview</h2>
                <p className="text-sm text-gray-500 mt-1">Verified e-waste collection metrics</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                {isReal ? 'Live Activity' : 'Demo Snapshot'}
              </span>
            </div>
            <MiniChart bars={[52,68,48,75,61,89,70]}/>
          </div>

          <div className="card p-6">
            <h2 className="font-bold text-lg text-slate-900">Material distribution</h2>
            <p className="text-sm text-gray-500 mt-1">Across intake categories</p>
            <DonutChart/>
            <div className="grid grid-cols-2 gap-3 mt-5">
              {[['Computers','emerald'],['Phones','sky'],['Cables','amber'],['Batteries','violet']].map(([x,c])=>(
                <div key={x} className="flex items-center gap-2 text-xs text-gray-600">
                  <span className={`size-2 rounded-full bg-${c}-500`}/>{x}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-900">Recent inventory items</h2>
              <Link href="/collector/inventory" className="text-sm text-primary font-semibold">View all</Link>
            </div>
            <div className="flex flex-col gap-4 mt-6">
              {loading ? (
                <div className="p-8 text-center text-gray-400 text-sm">Loading verified inventory...</div>
              ) : wasteItems.length > 0 ? (
                wasteItems.slice(0, 3).map((w) => {
                  const mat = typeof w.materialId === 'object' ? w.materialId : null
                  return (
                    <div key={w.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center gap-3">
                        {w.photo?.url ? (
                          <img
                            src={w.photo.url}
                            alt={mat?.name || 'E-waste item'}
                            className="size-10 rounded-xl object-cover border border-emerald-200 shrink-0"
                          />
                        ) : (
                          <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Package size={18}/>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm text-slate-900">{mat?.name || 'E-waste item'}</p>
                          <p className="text-xs text-gray-500">{w.quantityKg} kg · Status: {w.status.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-emerald-700">{money(w.estimatedValue)}</span>
                    </div>
                  )
                })
              ) : isReal ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Package size={28} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No e-waste items in inventory</p>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">Log collected electronics to start tracking weights, valuations, and requesting handovers.</p>
                  <Link href="/collector/add-waste" className="btn-primary text-xs py-2 px-3 mt-4 inline-flex">
                    <Plus size={14} className="mr-1.5"/> Add your first item
                  </Link>
                </div>
              ) : (
                mockRecentActivity.map((a,i)=>(
                  <div key={a.id} className="flex gap-4">
                    <div className={`size-9 rounded-full flex items-center justify-center ${i===0?'bg-emerald-100 text-emerald-600':i===1?'bg-sky-100 text-sky-600':'bg-gray-100 text-gray-600'}`}>
                      {i===0?<CheckCircle2 size={17}/>:i===1?<ShieldCheck size={17}/>:<Package size={17}/>}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-900">{a.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{a.time}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-slate-900">Nearby recyclers</h2>
              <Link href="/collector/recyclers" className="text-primary"><ChevronRight size={18}/></Link>
            </div>
            <div className="flex flex-col gap-4 mt-5">
              {displayRecyclers.map((r: any) => (
                <div key={r.id} className="flex gap-3">
                  <div className="size-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Building2 size={18}/>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{r.distance ? `${r.distance} km · ` : ''}{r.rating || 4.8} rating</p>
                    <div className="flex items-center gap-1 mt-2">
                      <ShieldCheck size={13} className="text-emerald-600"/>
                      <span className="text-[11px] text-emerald-700 font-medium">Verified Partner</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/collector/recyclers" className="btn-outline text-xs w-full mt-5">
              Explore on Interactive Map <ArrowRight size={13} className="ml-1" />
            </Link>
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}

function CollectorInventoryView(){
  const [items, setItems] = useState<WasteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'available' | 'reserved' | 'handed_over'>('all')
  const [selectedDetailItem, setSelectedDetailItem] = useState<WasteItem | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await wasteApi.getMyWasteItems()
      setItems(data)
    } catch (err: any) {
      setError(err.message || 'Could not load waste inventory')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  const filtered = items.filter(i => filter === 'all' ? true : i.status === filter)
  const availableItems = items.filter(i => i.status === 'available')
  const totalKg = items.reduce((sum, i) => sum + i.quantityKg, 0)
  const availableKg = availableItems.reduce((sum, i) => sum + i.quantityKg, 0)
  const totalValue = items.reduce((sum, i) => sum + i.estimatedValue, 0)

  return (
    <div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard icon={Package} label="Total Logged Items" value={`${items.length}`} />
        <StatCard icon={Recycle} label="Total Inventory Weight" value={`${totalKg} kg`} tone="blue" />
        <StatCard icon={CheckCircle2} label="Ready For Handover" value={`${availableKg} kg`} tone="amber" />
        <StatCard icon={CircleDollarSign} label="Estimated Inventory Value" value={money(totalValue)} tone="violet" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex gap-2 overflow-x-auto">
          {(['all', 'available', 'reserved', 'handed_over'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <Link href="/collector/add-waste" className="btn-primary">
          <Plus size={17} className="mr-2"/>Add new waste
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={fetchItems} className="text-xs font-bold text-rose-700 underline">
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="card p-16 text-center text-gray-500">
          <div className="size-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading your waste items from backend...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Package size={28} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No waste items found</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            {filter === 'all'
              ? 'You haven’t logged any e-waste items yet. Start adding materials to your inventory.'
              : `No items found in status "${filter.replace('_', ' ')}".`}
          </p>
          <Link href="/collector/add-waste" className="btn-primary mt-6 inline-flex">
            <Plus size={17} className="mr-2" />
            Add E-Waste Item
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(item => {
            const mat = typeof item.materialId === 'object' ? item.materialId : null
            const matName = mat?.name || 'E-waste item'
            const catName = mat?.category || 'General Electronics'

            return (
              <div key={item.id} className="card p-6 flex flex-col justify-between hover:border-emerald-300 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.photo?.url ? (
                        <button
                          type="button"
                          onClick={() => setSelectedDetailItem(item)}
                          className="size-14 rounded-xl overflow-hidden border border-emerald-200 bg-gray-100 shrink-0 group relative hover:opacity-90 transition-opacity"
                          title="Click to view photo & details"
                        >
                          <img
                            src={item.photo.url}
                            alt={matName}
                            className="size-full object-cover"
                          />
                        </button>
                      ) : (
                        <div className="size-14 rounded-xl bg-gray-50 border border-gray-200 text-gray-400 flex flex-col items-center justify-center shrink-0">
                          <Camera size={18} />
                          <span className="text-[9px] font-medium mt-0.5">No photo</span>
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-base">{matName}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{catName}</p>
                      </div>
                    </div>
                    <span
                      className={`text-xs uppercase font-bold px-2.5 py-1 rounded-full ${
                        item.status === 'available'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'reserved'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5 pt-4 border-t border-gray-100 text-sm">
                    <div>
                      <p className="text-xs text-gray-400">Weight</p>
                      <p className="font-bold text-slate-900 mt-0.5">{item.quantityKg} kg</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Est. Valuation</p>
                      <p className="font-bold text-emerald-700 mt-0.5">{money(item.estimatedValue)}</p>
                    </div>
                  </div>

                  {item.notes && (
                    <p className="text-xs text-gray-500 mt-4 bg-gray-50 p-2.5 rounded-lg line-clamp-2">
                      {item.notes}
                    </p>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailItem(item)}
                    className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    View Details
                  </button>
                  {item.status === 'available' ? (
                    <Link
                      href="/collector/recyclers"
                      className="btn-outline text-xs py-1.5 px-3"
                    >
                      Find Recycler <ArrowRight size={13} className="ml-1" />
                    </Link>
                  ) : (
                    <span className="text-xs text-gray-400 font-medium">In workflow</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Waste Item Details Modal */}
      {selectedDetailItem && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl my-8 relative animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-slate-900">E-Waste Item Details</h2>
              <button
                type="button"
                onClick={() => setSelectedDetailItem(null)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Photo preview */}
              {selectedDetailItem.photo?.url ? (
                <div className="rounded-2xl overflow-hidden border border-emerald-200 bg-slate-950/5 flex items-center justify-center max-h-72">
                  <img
                    src={selectedDetailItem.photo.url}
                    alt="Waste Item"
                    className="w-full max-h-72 object-contain"
                  />
                </div>
              ) : (
                <div className="rounded-2xl bg-gray-50 border border-dashed border-gray-200 p-8 text-center text-gray-400">
                  <Camera size={36} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No photo uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">
                    No photo was attached when this item was logged into inventory.
                  </p>
                </div>
              )}

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3.5 bg-gray-50 p-4 rounded-2xl border border-gray-100 text-sm">
                <div>
                  <p className="text-xs uppercase text-gray-400 font-semibold">Material</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {typeof selectedDetailItem.materialId === 'object'
                      ? selectedDetailItem.materialId?.name
                      : 'E-waste item'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {typeof selectedDetailItem.materialId === 'object'
                      ? selectedDetailItem.materialId?.category
                      : 'General Electronics'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400 font-semibold">Quantity</p>
                  <p className="font-bold text-slate-900 mt-0.5">{selectedDetailItem.quantityKg} kg</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400 font-semibold">Estimated Value</p>
                  <p className="font-bold text-emerald-700 mt-0.5">{money(selectedDetailItem.estimatedValue)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-gray-400 font-semibold">Status</p>
                  <span
                    className={`text-xs uppercase font-bold px-2.5 py-0.5 mt-0.5 inline-block rounded-full ${
                      selectedDetailItem.status === 'available'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedDetailItem.status === 'reserved'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-sky-100 text-sky-800'
                    }`}
                  >
                    {selectedDetailItem.status.replace('_', ' ')}
                  </span>
                </div>
                {selectedDetailItem.notes && (
                  <div className="col-span-2 pt-2 border-t border-gray-200/60">
                    <p className="text-xs uppercase text-gray-400 font-semibold">Notes</p>
                    <p className="text-xs text-gray-700 mt-1">{selectedDetailItem.notes}</p>
                  </div>
                )}
                <div className="col-span-2 pt-2 border-t border-gray-200/60">
                  <p className="text-xs uppercase text-gray-400 font-semibold">Logged On</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(selectedDetailItem.createdAt).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedDetailItem(null)}
                  className="btn-outline text-xs px-5 py-2"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CollectorPage({ type }: {type:string}){
  const titles:Record<string,[string,string]>={
    inventory:['Waste Inventory','View, track, and manage all your collected materials and their handover readiness.'],
    materials:['Materials & indicative prices','Know the current market before you hand over.'],
    recyclers:['Find a suitable recycler','Connect with verified partners near you.'],
    requests:['Handover requests','Track every request from first message to completed handover.'],
    transactions:['Transactions','Your digital record of completed and pending payments.'],
    earnings:['Earnings','A clear view of your recycling income.'],
    notifications:['Notifications','Stay in the loop with your recycling network.'],
    profile:['Your profile','Keep your collector identity and preferences up to date.'],
    settings:['Settings','Manage your account preferences.']
  };
  const [title,desc]=titles[type]||['Collector workspace','Manage your e-waste journey.'];
  return <DashboardShell role="collector"><PageHeader title={title} description={desc}/><div className="container-app py-8">{type==='inventory'?<CollectorInventoryView/>:type==='materials'?<MaterialsGrid/>:type==='recyclers'?<RecyclerDiscovery/>:type==='requests'?<RequestsView/>:type==='transactions'?<TransactionsView/>:type==='earnings'?<EarningsView/>:type==='notifications'?<NotificationsView/>:type==='profile'?<ProfileView/>:<SettingsView/>}</div></DashboardShell>
}

function RequestsView(){
  const { user, isAuthenticated } = useAuth()
  const [realRequests, setRealRequests] = useState<HandoverRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('All')
  const filters = ['All', 'Pending', 'Accepted', 'Scheduled', 'In Transit', 'Completed', 'Rejected']

  const fetchRequests = () => {
    if (isAuthenticated) {
      setLoading(true)
      setError(null)
      requestsApi.getMyRequests()
        .then((data) => {
          setRealRequests(data)
        })
        .catch((err) => {
          console.warn('Could not fetch real requests:', err)
          setError(err.message || 'Failed to load requests from backend.')
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
  }, [isAuthenticated])

  const filteredReal = realRequests.filter(r => filter === 'All' ? true : r.status.toLowerCase() === filter.toLowerCase().replace(' ', '_'))

  return <div><div className="flex flex-wrap items-center justify-between gap-4 mb-6"><div className="flex gap-2 overflow-x-auto">{filters.map(f=><button key={f} onClick={()=>setFilter(f)} className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filter===f?'bg-slate-950 text-white':'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{f}</button>)}</div><Link href="/collector/add-waste" className="btn-primary"><Plus size={17} className="mr-2"/>New request</Link></div>{error && isAuthenticated && (
    <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle size={18} className="text-rose-600 shrink-0" />
        <span>{error}</span>
      </div>
      <button onClick={fetchRequests} className="text-xs font-bold text-rose-700 underline">
        Retry
      </button>
    </div>
  )}<div className="flex flex-col gap-4">{loading ? <div className="card p-12 text-center text-gray-500">Loading requests...</div> : isAuthenticated ? (
    realRequests.length === 0 ? (
      <div className="card p-12 text-center">
        <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <Package size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No handover requests found</h3>
        <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
          You haven&apos;t created any handover requests yet. Select items from your inventory to initiate a handover with an authorized recycler.
        </p>
        <Link href="/collector/add-waste" className="btn-primary mt-6 inline-flex">
          <Plus size={17} className="mr-2" />
          New Request
        </Link>
      </div>
    ) : filteredReal.length === 0 ? (
      <div className="card p-8 text-center text-gray-500">
        No requests match the selected status &quot;{filter}&quot;.
      </div>
    ) : (
      filteredReal.map(r => {
        const rec = typeof r.recyclerId === 'object' ? r.recyclerId : null
        const recName = rec?.organizationName || rec?.businessName || 'Recycler'
        return <Link key={r.id} href={`/collector/requests/${r.id}`} className="card p-5 hover:border-emerald-300 transition-all"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-start gap-4"><div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Package size={20}/></div><div><p className="font-bold text-slate-900">{r.totalQuantityKg} kg Handover</p><p className="text-sm text-gray-500 mt-1">To {recName} · Est. {money(r.estimatedValue)}</p><p className="text-xs text-gray-400 mt-1">Created {new Date(r.createdAt).toLocaleDateString('en-IN')}</p></div></div><div className="flex items-center gap-3"><span className={`text-xs uppercase font-bold px-3 py-1.5 rounded-full ${r.status==='completed'?'bg-emerald-100 text-emerald-800':r.status==='accepted'||r.status==='scheduled'||r.status==='in_transit'?'bg-sky-100 text-sky-800':r.status==='rejected'?'bg-rose-100 text-rose-800':'bg-amber-100 text-amber-800'}`}>{r.status.replace('_',' ')}</span><button className="btn-ghost text-sm">View details <ChevronRight size={15} className="ml-1"/></button></div></div></Link>
      })
    )
  ) : mockRequests.map(r=><div key={r.id} className="card p-5"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="flex items-start gap-4"><div className="size-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Package size={20}/></div><div><p className="font-bold text-slate-900">{r.material}</p><p className="text-sm text-gray-500 mt-1">Request {r.id.toUpperCase()} · {r.weight} kg · {money(r.estimatedValue)}</p><p className="text-xs text-gray-400 mt-2">{mockRecyclers.find(x=>x.id===r.recyclerId)?.name} · Created {r.createdDate}</p></div></div><div className="flex items-center gap-3"><span className={`status-${r.status==='completed'?'completed':r.status==='accepted'?'accepted':r.status==='rejected'?'rejected':'pending'}`}>{r.status}</span><Link href={`/collector/requests/${r.id}`} className="btn-ghost text-sm">View details <ChevronRight size={15} className="ml-1"/></Link></div></div></div>)}</div></div>
}

function TransactionsView() {
  const { isAuthenticated } = useAuth()
  const [realTransactions, setRealTransactions] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const fetchTransactions = () => {
    if (!isAuthenticated) return
    setLoading(true)
    setError(null)
    transactionsApi.getMyTransactions()
      .then((data) => {
        setRealTransactions(data)
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load transactions.')
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchTransactions()
  }, [isAuthenticated])

  const filteredReal = realTransactions.filter(t => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    const ref = (t.transactionReference || t.id).toLowerCase()
    const recName = typeof t.recyclerId === 'object' ? (t.recyclerId?.organizationName || t.recyclerId?.businessName || '').toLowerCase() : ''
    return ref.includes(term) || recName.includes(term)
  })

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-3 top-3 text-gray-400" size={18}/>
          <input
            className="form-input pl-10"
            placeholder="Search by reference or recycler..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="inline-flex items-center px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
          Simulated Settlement
        </div>
      </div>

      {error && isAuthenticated && (
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

      {loading ? (
        <div className="card p-12 text-center text-gray-500">Loading transactions...</div>
      ) : isAuthenticated ? (
        realTransactions.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="size-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
              <CircleDollarSign size={28} />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No transactions yet</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
              Completed handovers generate automated simulated settlement transactions and digital records.
            </p>
            <Link href="/collector/requests" className="btn-primary mt-6 inline-flex">
              View Handover Requests
            </Link>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  {['Reference', 'Date', 'Recycler', 'Weight', 'Amount', 'Payment Method', 'Status'].map(x => (
                    <th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredReal.map(t => {
                  const rec = typeof t.recyclerId === 'object' ? t.recyclerId : null
                  const recName = rec?.organizationName || rec?.businessName || 'Recycler'
                  const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-IN') : 'Recent'
                  const handoverReqId = typeof t.handoverRequestId === 'object' ? (t.handoverRequestId as any)?.id || (t.handoverRequestId as any)?._id : t.handoverRequestId
                  const record = typeof t.handoverRecordId === 'object' ? (t.handoverRecordId as any) : null
                  const weightKg = record?.totalQuantityKg != null ? `${record.totalQuantityKg} kg` : '-'

                  return (
                    <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs font-bold text-slate-900 block">{t.transactionReference}</span>
                        {handoverReqId && (
                          <Link href={`/collector/handover/${handoverReqId}`} className="text-xs text-primary hover:underline">
                            View Handover Record
                          </Link>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">{dateStr}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{recName}</td>
                      <td className="px-5 py-4 text-sm text-gray-600">{weightKg}</td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-900">{money(t.amount)}</td>
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
          </div>
        )
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>{['Transaction ID','Date','Recycler','Material','Weight','Amount','Status'].map(x=><th key={x} className="px-5 py-4 text-xs uppercase tracking-wide text-gray-500 font-semibold">{x}</th>)}</tr>
            </thead>
            <tbody>
              {mockTransactions.map(t=>(
                <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{t.id.toUpperCase()}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.date}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.recyclerName}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.material}</td>
                  <td className="px-5 py-4 text-sm text-gray-600">{t.weight} kg</td>
                  <td className="px-5 py-4 text-sm font-semibold text-slate-900">{money(t.amount)}</td>
                  <td className="px-5 py-4"><span className={t.status==='completed'?'status-completed':'status-pending'}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function EarningsView() {
  const { isAuthenticated } = useAuth()
  const [realTransactions, setRealTransactions] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return
    setLoading(true)
    setError(null)
    transactionsApi.getMyTransactions()
      .then((data) => {
        setRealTransactions(data)
      })
      .catch((err: any) => {
        setError(err.message || 'Failed to load earnings data.')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [isAuthenticated])

  const totalEarnings = realTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.amount, 0)

  const currentMonth = new Date().getMonth()
  const currentYear = new Date().getFullYear()
  const thisMonthEarnings = realTransactions
    .filter(t => t.status === 'completed' && t.createdAt)
    .filter(t => {
      const d = new Date(t.createdAt!)
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
    .reduce((sum, t) => sum + t.amount, 0)

  const totalKg = realTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => {
      const record = typeof t.handoverRecordId === 'object' ? (t.handoverRecordId as any) : null
      return sum + (record?.totalQuantityKg || 0)
    }, 0)

  if (isAuthenticated) {
    return (
      <div>
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {loading ? (
          <div className="card p-12 text-center text-gray-500">Loading verified earnings...</div>
        ) : (
          <>
            <div className="grid sm:grid-cols-3 gap-5">
              <StatCard
                icon={CircleDollarSign}
                label="Total verified earnings"
                value={money(totalEarnings)}
                trend={`${realTransactions.length} handovers`}
              />
              <StatCard
                icon={Calendar}
                label="This month"
                value={money(thisMonthEarnings)}
                tone="blue"
              />
              <StatCard
                icon={Package}
                label="Total e-waste handed over"
                value={`${totalKg} kg`}
                tone="amber"
              />
            </div>

            <div className="grid lg:grid-cols-3 gap-6 mt-6">
              <div className="card p-6 lg:col-span-2">
                <h2 className="font-bold text-lg">Verified Settlement History</h2>
                <p className="text-sm text-gray-500 mt-1">Settlement amounts from completed digital handovers</p>
                {realTransactions.length > 0 ? (
                  <div className="flex flex-col gap-3 mt-6">
                    {realTransactions.map(t => {
                      const rec = typeof t.recyclerId === 'object' ? t.recyclerId : null
                      const recName = rec?.organizationName || rec?.businessName || 'Authorized Recycler'
                      const handoverReqId = typeof t.handoverRequestId === 'object' ? (t.handoverRequestId as any)?.id || (t.handoverRequestId as any)?._id : t.handoverRequestId
                      const record = typeof t.handoverRecordId === 'object' ? (t.handoverRecordId as any) : null
                      const weightStr = record?.totalQuantityKg != null ? `${record.totalQuantityKg} kg` : '-'
                      return (
                        <div key={t.id} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{recName}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {t.transactionReference} · {weightStr}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-700">+{money(t.amount)}</p>
                            {handoverReqId && (
                              <Link href={`/collector/handover/${handoverReqId}`} className="text-xs text-primary hover:underline">
                                View Record
                              </Link>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mt-6">No completed handovers yet. Start a handover to record earnings.</p>
                )}
              </div>

              <div className="card p-6">
                <h2 className="font-bold text-lg">Settlement Details</h2>
                <div className="mt-5 space-y-4 text-sm">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="font-bold text-emerald-900">Simulated Settlement</p>
                    <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                      Transactions in this prototype are simulated upon handover completion according to verified item valuations.
                    </p>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Method</span>
                    <span className="font-medium text-slate-800">Simulated Settlement</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-500">Completed Records</span>
                    <span className="font-medium text-slate-800">{realTransactions.length}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium text-emerald-600">Settled</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0"/>
          <span>Payments shown represent prototype simulated settlements for completed handovers. No real money movement is executed.</span>
        </div>
      </div>
    )
  }

  return <div><div className="grid sm:grid-cols-3 gap-5"><StatCard icon={CircleDollarSign} label="Total earnings" value="₹48,650" trend="18.6%"/><StatCard icon={Calendar} label="This month" value="₹12,480" tone="blue"/><StatCard icon={Clock3} label="Pending payments" value="₹7,440" tone="amber"/></div><div className="grid lg:grid-cols-3 gap-6 mt-6"><div className="card p-6 lg:col-span-2"><h2 className="font-bold text-lg">Monthly earnings</h2><p className="text-sm text-gray-500 mt-1">Earnings across the last 6 months</p><MiniChart bars={[38,51,44,68,57,84,72]}/></div><div className="card p-6"><h2 className="font-bold text-lg">Recent payments</h2><div className="flex flex-col gap-5 mt-5">{mockTransactions.slice(0,3).map(t=><div key={t.id} className="flex justify-between"><div><p className="text-sm font-medium">{t.material}</p><p className="text-xs text-gray-500 mt-1">{t.date}</p></div><p className="text-sm font-bold text-emerald-600">+{money(t.amount)}</p></div>)}</div></div></div><div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-start gap-3"><AlertCircle size={18} className="mt-0.5"/>Payments shown are prototype/demo data and do not represent real money movement.</div></div>
}
function NotificationsView(){return <NotificationCenter role="collector"/>}
function ProfileView(){return <div className="grid lg:grid-cols-3 gap-6"><div className="card p-6 text-center"><div className="size-24 rounded-3xl bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center text-3xl font-bold">R</div><h2 className="text-xl font-bold mt-5">Ravi Kumar</h2><p className="text-gray-500 mt-1">Collector ID: COL-001</p><span className="badge-success mt-4"><ShieldCheck size={14} className="mr-1"/>Verified collector</span><button className="btn-outline w-full mt-6"><Pencil size={16} className="mr-2"/>Edit profile</button></div><div className="card p-6 lg:col-span-2"><h2 className="font-bold text-lg">Personal information</h2><div className="grid sm:grid-cols-2 gap-5 mt-6">{[['Full name','Ravi Kumar'],['Phone','+91 9876543210'],['Email','ravi.kumar@example.com'],['Location','Charminar, Hyderabad'],['Registration date','15 Jan 2024'],['Status','Verified']].map(([l,v])=><div key={l}><p className="text-xs uppercase tracking-wide text-gray-400">{l}</p><p className="font-medium text-slate-900 mt-2">{v}</p></div>)}</div></div></div>}
function SettingsView(){return <div className="max-w-3xl card p-6"><h2 className="font-bold text-lg">Account preferences</h2><div className="flex flex-col gap-5 mt-6">{[['Email notifications','Get updates about requests and payments'],['Price alerts','Know when material prices change'],['Weekly summary','Receive a weekly collection summary']].map(([x,y])=><div key={x} className="flex items-center justify-between gap-4"><div><p className="font-medium text-slate-900">{x}</p><p className="text-sm text-gray-500 mt-1">{y}</p></div><div className="size-6 rounded-full bg-emerald-600 flex items-center justify-center text-white"><Check size={14}/></div></div>)}</div><button className="btn-primary mt-8">Save preferences</button></div>}

function AddWaste(){
  const router = useRouter()
  const { user, isAuthenticated } = useAuth()
  const [step, setStep] = useState(1)
  const [materials, setMaterials] = useState<Material[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(true)
  const [materialsError, setMaterialsError] = useState<string | null>(null)
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('')
  const [quantityKg, setQuantityKg] = useState('10')
  const [notes, setNotes] = useState('')
  const [condition, setCondition] = useState('Working / Mixed')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [createdItem, setCreatedItem] = useState<WasteItem | null>(null)

  // Photo upload state
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  const validateAndSetFile = (file: File) => {
    setPhotoError(null)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setPhotoError('Only JPG, PNG and WEBP images up to 5MB are allowed.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Image must be smaller than 5MB.')
      return
    }

    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleRemovePhoto = () => {
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
    }
    setPhotoFile(null)
    setPhotoPreview(null)
    setPhotoError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const fetchMaterials = () => {
    let mounted = true
    setLoadingMaterials(true)
    setMaterialsError(null)
    materialsApi.getMaterials()
      .then((data) => {
        if (!mounted) return
        if (data.length > 0) {
          setMaterials(data)
          setSelectedMaterialId(data[0].id)
        } else {
          setMaterialsError('No active materials found in platform catalog.')
        }
      })
      .catch((err) => {
        if (!mounted) return
        console.warn('Could not fetch backend materials:', err)
        setMaterialsError('Failed to load verified materials catalog from server. Please check your connection.')
      })
      .finally(() => {
        if (mounted) setLoadingMaterials(false)
      })
    return () => { mounted = false }
  }

  useEffect(() => {
    const cleanup = fetchMaterials()
    return () => { if (cleanup) cleanup() }
  }, [])

  const selectedMaterial = materials.find(m => m.id === selectedMaterialId) || materials[0]
  const indicativeRate = selectedMaterial?.indicativePrice || 0
  const parsedWeight = parseFloat(quantityKg) || 0
  const estimatedTotalValue = Math.round(parsedWeight * indicativeRate)

  const handleCreateWaste = async () => {
    const objectIdRegex = /^[0-9a-fA-F]{24}$/
    if (!selectedMaterial?.id || !objectIdRegex.test(selectedMaterial.id)) {
      setSubmitError('Please select a valid material from the verified catalog.')
      return
    }
    if (parsedWeight <= 0) {
      setSubmitError('Please enter a valid weight greater than 0 kg.')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const item = await wasteApi.createWasteItem({
        materialId: selectedMaterial.id,
        quantityKg: parsedWeight,
        notes: notes ? `${condition}: ${notes}` : condition,
        photo: photoFile,
      })
      setCreatedItem(item)
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to save waste item to backend. Please check connection.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DashboardShell role="collector">
      <PageHeader
        title="Add e-waste"
        description="Log your collected e-waste into your verified digital inventory."
      />
      <div className="container-app py-8 max-w-4xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-between mb-8">
          {['Select material', 'Add details', 'Upload photo', 'Review & save'].map((x, i) => (
            <div key={x} className="flex items-center gap-2 flex-1 last:flex-none">
              <div
                className={`size-9 rounded-full flex items-center justify-center font-semibold text-sm transition-colors ${
                  createdItem
                    ? 'bg-emerald-600 text-white'
                    : step > i + 1
                    ? 'bg-emerald-600 text-white'
                    : step === i + 1
                    ? 'bg-slate-950 text-white'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {createdItem || step > i + 1 ? <Check size={16} /> : i + 1}
              </div>
              <span className="hidden sm:block text-xs font-medium text-gray-600">{x}</span>
              {i < 3 && <div className="h-px bg-gray-200 flex-1 mx-2" />}
            </div>
          ))}
        </div>

        <div className="card p-6 md:p-8">
          {submitError && (
            <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2">
              <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {createdItem ? (
            <div className="py-8 text-center">
              <div className="size-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={36} />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">E-Waste Added to Inventory!</h2>
              <p className="text-gray-500 mt-2 max-w-md mx-auto">
                Your collected material has been recorded with a server-verified estimated valuation.
              </p>

              <div className="mt-6 p-6 rounded-2xl bg-gray-50 max-w-md mx-auto grid grid-cols-2 gap-4 text-left border border-gray-100">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Material</p>
                  <p className="font-bold text-slate-900 mt-1">
                    {typeof createdItem.materialId === 'object'
                      ? createdItem.materialId?.name
                      : selectedMaterial?.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Quantity</p>
                  <p className="font-bold text-slate-900 mt-1">{createdItem.quantityKg} kg</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Est. Value</p>
                  <p className="font-bold text-emerald-700 mt-1">{money(createdItem.estimatedValue)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Status</p>
                  <span className="badge-success mt-1 inline-block">Available</span>
                </div>
                {createdItem.photo?.url && (
                  <div className="col-span-2 pt-3 border-t border-gray-200/60 flex items-center gap-3">
                    <img
                      src={createdItem.photo.url}
                      alt="Created Item Photo"
                      className="size-14 rounded-xl object-cover border border-emerald-200 shadow-xs"
                    />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-semibold">Attached Photo</p>
                      <p className="text-xs text-emerald-700 font-medium mt-0.5">Uploaded & linked to item</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap justify-center gap-3 mt-8">
                <Link href="/collector/inventory" className="btn-primary">
                  <Package size={17} className="mr-2" />
                  View Inventory
                </Link>
                <Link href="/collector/recyclers" className="btn-outline">
                  Find Recycler to Handover <ArrowRight size={17} className="ml-2" />
                </Link>
                <button
                  onClick={() => {
                    setCreatedItem(null)
                    setStep(1)
                    setQuantityKg('10')
                    setNotes('')
                    handleRemovePhoto()
                  }}
                  className="btn-ghost"
                >
                  Add Another Item
                </button>
              </div>
            </div>
          ) : (
            <>
              {step === 1 && (
                <>
                  <h2 className="text-xl font-bold text-slate-900">What did you collect?</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose from the active materials catalog with verified indicative rates.
                  </p>
                  {loadingMaterials ? (
                    <div className="py-16 text-center text-gray-500">
                      <div className="size-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-sm font-medium">Loading verified materials catalog...</p>
                    </div>
                  ) : materialsError ? (
                    <div className="mt-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-3">
                      <AlertCircle size={18} className="text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-rose-900">Catalog Unavailable</p>
                        <p className="mt-0.5">{materialsError}</p>
                        <button
                          type="button"
                          onClick={fetchMaterials}
                          className="mt-2 text-xs font-semibold text-rose-700 underline hover:text-rose-900"
                        >
                          Retry loading catalog
                        </button>
                      </div>
                    </div>
                  ) : materials.length === 0 ? (
                    <div className="mt-6 p-6 rounded-2xl bg-gray-50 border border-gray-200 text-center text-gray-500">
                      <p className="text-sm">No active materials currently available in the platform catalog.</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 mt-6 max-h-96 overflow-y-auto pr-1">
                      {materials.map((m) => {
                        const isSelected = selectedMaterialId === m.id
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setSelectedMaterialId(m.id)}
                            className={`p-4 rounded-2xl border text-left transition-all ${
                              isSelected
                                ? 'border-emerald-500 bg-emerald-50/60 shadow-xs'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <span className="size-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <Recycle size={18} />
                              </span>
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                                ₹{m.indicativePrice}/kg
                              </span>
                            </div>
                            <p className="text-sm font-bold text-slate-900 mt-3">{m.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{m.category}</p>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </>
              )}

              {step === 2 && (
                <>
                  <h2 className="text-xl font-bold text-slate-900">Add material details</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Help recyclers understand item quantity and condition.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-5 mt-6">
                    <label className="text-sm font-medium text-slate-700">
                      Selected Material
                      <input
                        className="form-input mt-2 bg-gray-50 text-gray-700 font-semibold"
                        value={selectedMaterial?.name || ''}
                        readOnly
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700">
                      Weight in Kilograms (kg) *
                      <input
                        type="number"
                        min="0.1"
                        step="0.1"
                        className="form-input mt-2"
                        placeholder="e.g. 15"
                        value={quantityKg}
                        onChange={(e) => setQuantityKg(e.target.value)}
                        required
                      />
                    </label>
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                      Condition
                      <select
                        className="form-input mt-2"
                        value={condition}
                        onChange={(e) => setCondition(e.target.value)}
                      >
                        <option>Working / Mixed</option>
                        <option>Damaged / Incomplete</option>
                        <option>Scrap / Non-working</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                      Notes / Device details (optional)
                      <textarea
                        className="form-input mt-2"
                        rows={2}
                        placeholder="e.g. 3 desktop towers with power cables, sorted into bin."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </label>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Photo of E-Waste (Optional)</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        A clear photo helps authorized recyclers assess material condition and prepare intake.
                      </p>
                    </div>
                    {photoFile && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-200"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>

                  {photoError && (
                    <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2">
                      <AlertCircle size={17} className="text-rose-600 shrink-0 mt-0.5" />
                      <span>{photoError}</span>
                    </div>
                  )}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        validateAndSetFile(e.target.files[0])
                      }
                    }}
                  />

                  {photoPreview && photoFile ? (
                    <div className="mt-6 rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/20 p-6 flex flex-col sm:flex-row items-center gap-6">
                      <div className="relative size-44 rounded-xl overflow-hidden bg-slate-900/5 border border-emerald-200 shrink-0 shadow-xs">
                        <img
                          src={photoPreview}
                          alt="E-waste preview"
                          className="size-full object-cover"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left min-w-0">
                        <div className="flex items-center justify-center sm:justify-start gap-2 text-emerald-700 font-semibold text-sm">
                          <CheckCircle2 size={18} />
                          Photo attached successfully
                        </div>
                        <p className="font-bold text-slate-900 mt-2 truncate text-base">
                          {photoFile.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(photoFile.size / (1024 * 1024)).toFixed(2)} MB · {photoFile.type}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-4 justify-center sm:justify-start">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="btn-outline text-xs py-2 px-3.5"
                          >
                            Change photo
                          </button>
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            className="btn-ghost text-xs py-2 px-3.5 text-rose-600 hover:text-rose-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault()
                        setIsDragging(true)
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragging(false)
                        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                          validateAndSetFile(e.dataTransfer.files[0])
                        }
                      }}
                      onClick={() => fileInputRef.current?.click()}
                      className={`mt-6 border-2 border-dashed rounded-2xl p-10 md:p-12 text-center cursor-pointer transition-all ${
                        isDragging
                          ? 'border-emerald-500 bg-emerald-100/50 scale-[0.99]'
                          : 'border-emerald-300/80 bg-emerald-50/40 hover:bg-emerald-50/70 hover:border-emerald-500'
                      }`}
                    >
                      <div className="size-16 rounded-2xl bg-white text-emerald-600 flex items-center justify-center mx-auto shadow-xs border border-emerald-100">
                        <Camera size={30} />
                      </div>
                      <p className="font-bold text-slate-900 text-lg mt-4">Add Photo</p>
                      <p className="text-sm text-gray-600 mt-1">
                        Click to upload image or drag & drop
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        JPG, PNG or WEBP · Max 5MB · Optional
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          fileInputRef.current?.click()
                        }}
                        className="btn-outline text-xs mt-5 inline-flex items-center gap-2"
                      >
                        <Upload size={14} /> Browse from Device
                      </button>
                    </div>
                  )}
                </>
              )}

              {step === 4 && (
                <>
                  <h2 className="text-xl font-bold text-slate-900">Review your e-waste</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Valuation is calculated against current authorized recycler intake prices.
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4 mt-6">
                    <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Material</p>
                      <p className="font-bold text-slate-900 text-lg mt-1">
                        {selectedMaterial?.name}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{selectedMaterial?.category}</p>
                    </div>
                    <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Weight</p>
                      <p className="font-bold text-slate-900 text-lg mt-1">{parsedWeight} kg</p>
                      <p className="text-xs text-gray-500 mt-0.5">Indicative: ₹{indicativeRate}/kg</p>
                    </div>
                    <div className="rounded-2xl bg-emerald-50 p-5 border border-emerald-100">
                      <p className="text-xs text-emerald-700 uppercase tracking-wide">Estimated Value</p>
                      <p className="text-2xl font-bold text-emerald-700 mt-1">
                        {money(estimatedTotalValue)}
                      </p>
                      <p className="text-xs text-emerald-600 mt-0.5">
                        Will be validated upon submission
                      </p>
                    </div>
                    <div className="rounded-2xl bg-sky-50 p-5 border border-sky-100">
                      <p className="text-xs text-sky-700 uppercase tracking-wide">Target Next Step</p>
                      <p className="text-2xl font-bold text-sky-700 mt-1">Ready for Handover</p>
                      <p className="text-xs text-sky-600 mt-0.5">Available in your inventory</p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-5 border border-gray-100 sm:col-span-2 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Photo of E-Waste</p>
                        <p className="font-semibold text-slate-900 mt-1">
                          {photoFile ? photoFile.name : 'No photo attached (optional)'}
                        </p>
                        {photoFile && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {(photoFile.size / (1024 * 1024)).toFixed(2)} MB · Attached for upload
                          </p>
                        )}
                      </div>
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Review"
                          className="size-14 rounded-xl object-cover border border-emerald-200 shadow-xs shrink-0"
                        />
                      ) : (
                        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">
                          No photo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-6 p-4 rounded-xl bg-amber-50 text-xs text-amber-800 border border-amber-200">
                    Prototype estimate only. Final settlement amounts will be confirmed upon facility inspection.
                  </div>
                </>
              )}

              <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setStep(Math.max(1, step - 1))}
                  className={`btn-ghost ${step === 1 ? 'invisible' : ''}`}
                  disabled={submitting}
                >
                  <ChevronLeft size={16} className="mr-1" />
                  Back
                </button>
                {step < 4 ? (
                  <button
                    type="button"
                    onClick={() => setStep(step + 1)}
                    disabled={step === 1 && (loadingMaterials || !selectedMaterial?.id || !/^[0-9a-fA-F]{24}$/.test(selectedMaterial.id))}
                    className="btn-primary disabled:opacity-50"
                  >
                    Continue <ArrowRight size={16} className="ml-2" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCreateWaste}
                    disabled={submitting}
                    className="btn-primary disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        {photoFile ? 'Uploading photo & saving...' : 'Saving to inventory...'}
                      </span>
                    ) : (
                      <>
                        Save to Waste Inventory <ArrowRight size={16} className="ml-2" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  )
}

function KabiAI(){
  return (
    <DashboardShell role="collector">
      <PageHeader title="KabiAI Assistant" description="Your smart e-waste recycling and platform guidance assistant." />
      <div className="container-app py-8">
        <KabiAIView />
      </div>
    </DashboardShell>
  )
}

function RecyclerDashboard(){
  const { user, isAuthenticated } = useAuth()
  const [requests, setRequests] = useState<HandoverRequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    setDashboardError(null)
    try {
      const data = await requestsApi.getIncomingRequests()
      setRequests(data)
    } catch (err: any) {
      console.warn('Could not load incoming requests from backend:', err)
      setDashboardError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated && user?.role === 'recycler') {
      fetchRequests()
    } else {
      setLoading(false)
    }
  }, [isAuthenticated, user?.role])

  const handleAccept = async (id: string) => {
    setActionLoading(id)
    try {
      const updated = await requestsApi.acceptRequest(id)
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
    } catch (err: any) {
      alert(err.message || 'Failed to accept request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (id: string) => {
    const reason = prompt('Please enter a reason for rejection (optional):')
    if (reason === null) return
    setActionLoading(id)
    try {
      const updated = await requestsApi.rejectRequest(id, { reason })
      setRequests(prev => prev.map(r => r.id === id ? updated : r))
    } catch (err: any) {
      alert(err.message || 'Failed to reject request')
    } finally {
      setActionLoading(null)
    }
  }

  const isReal = isAuthenticated && user?.role === 'recycler'
  const pendingCount = requests.filter(r => r.status === 'pending').length
  const acceptedCount = requests.filter(r => r.status === 'accepted').length
  const completedCount = requests.filter(r => r.status === 'completed').length
  const totalWeightProcessed = requests.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.totalQuantityKg, 0)

  return (
    <DashboardShell role="recycler">
      <PageHeader
        title="Good morning, GreenCycle"
        description="Here's your verified recycling operations overview."
      />
      <div className="container-app py-8">
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatCard
            icon={Clock3}
            label="Pending Requests"
            value={isReal ? `${pendingCount}` : "8"}
            tone="amber"
          />
          <StatCard
            icon={CheckCircle2}
            label="Accepted Handover"
            value={isReal ? `${acceptedCount}` : "5"}
            trend={isReal ? "Live" : "12%"}
            tone="blue"
          />
          <StatCard
            icon={Recycle}
            label="Completed Handovers"
            value={isReal ? `${completedCount}` : "156"}
          />
          <StatCard
            icon={TrendingUp}
            label="Total Processed"
            value={isReal ? `${totalWeightProcessed} kg` : "3,420 kg"}
            trend={isReal ? "Verified" : "8.4%"}
            tone="violet"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="card p-6 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold text-lg">Monthly intake volume</h2>
                <p className="text-sm text-gray-500 mt-1">Material received at your facility</p>
              </div>
              <BarChart3 className="text-emerald-600"/>
            </div>
            <MiniChart bars={[48,64,57,78,69,88,74]}/>
          </div>

          <div className="card p-6">
            <h2 className="font-bold text-lg">Intake distribution</h2>
            <p className="text-sm text-gray-500 mt-1">By material category</p>
            <DonutChart/>
          </div>
        </div>

        <div className="card p-6 mt-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-lg">Incoming requests</h2>
              <p className="text-sm text-gray-500 mt-1">Review and respond to collector handover requests.</p>
            </div>
            <Link href="/recycler/requests" className="btn-outline text-sm">View all</Link>
          </div>

          <div className="flex flex-col gap-3">
            {loading ? (
              <p className="text-sm text-gray-500 py-6 text-center">Loading incoming requests...</p>
            ) : isReal ? (
              requests.length > 0 ? (
                requests.slice(0, 5).map(r => {
                  const col = typeof r.collectorId === 'object' ? r.collectorId : null
                  const collectorName = col?.name || 'Collector'
                  return (
                    <div key={r.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
                      <div>
                        <p className="font-semibold text-slate-900">{r.totalQuantityKg} kg Handover</p>
                        <p className="text-sm text-gray-500 mt-1">From {collectorName} · Est. {money(r.estimatedValue)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.status === 'pending' ? (
                          <>
                            <button onClick={()=>handleAccept(r.id)} disabled={actionLoading === r.id} className="btn-primary text-sm">
                              <Check size={15} className="mr-1"/>{actionLoading === r.id ? '...' : 'Accept'}
                            </button>
                            <button onClick={()=>handleReject(r.id)} disabled={actionLoading === r.id} className="btn-outline text-sm">
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className={`text-xs uppercase font-bold px-2.5 py-1 rounded-full ${r.status==='accepted'?'bg-sky-100 text-sky-800':r.status==='completed'?'bg-emerald-100 text-emerald-800':'bg-gray-100 text-gray-800'}`}>
                            {r.status.replace('_', ' ')}
                          </span>
                        )}
                        <Link href={`/recycler/requests/${r.id}`} className="btn-ghost text-xs">Details</Link>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <Clock3 size={28} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-800">No incoming handover requests</p>
                  <p className="text-xs text-gray-500 mt-1">When collectors create handover requests for your facility, they will appear here in real time.</p>
                </div>
              )
            ) : (
              mockRequests.slice(0,3).map(r=>(
                <div key={r.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
                  <div>
                    <p className="font-semibold">{r.material} · {r.weight} kg</p>
                    <p className="text-sm text-gray-500 mt-1">From Ravi Kumar · {r.createdDate} · Est. {money(r.estimatedValue)}</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="status-accepted">{r.status}</span>
                    <Link href={`/recycler/requests/${r.id}`} className="btn-ghost text-xs">Details</Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardShell>
  )
}
function RecyclerPage({type}:{type:string}){const pages: Record<string, React.ReactNode>={accepted:<RecyclerAcceptedPage/>,completed:<RecyclerCompletedPage/>,materials:<RecyclerMaterialsPage/>,transactions:<RecyclerTransactionsPage/>,reports:<RecyclerReportsPage/>,notifications:<RecyclerNotificationsPage/>,location:<RecyclerLocationManager/>,settings:<RecyclerSettingsPage/>}; const content=pages[type]; if(content) return <DashboardShell role="recycler">{content}</DashboardShell>; return <DashboardShell role="recycler"><PageHeader title={type==='requests'?'Incoming requests':type==='profile'?'Recycler profile':'Recycler workspace'} description="Manage your verified recycling operations."/><div className="container-app py-8">{type==='requests'?<RequestsView/>:type==='profile'?<div className="flex flex-col gap-6"><div className="card p-8 max-w-3xl"><div className="flex items-center gap-4"><div className="size-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center"><Building2 size={30}/></div><div><h2 className="text-2xl font-bold">GreenCycle Recycling</h2><p className="text-gray-500 mt-1">Registration ID: GR-HYD-2026-001</p></div><span className="badge-success ml-auto"><ShieldCheck size={14} className="mr-1"/>Verified</span></div><div className="grid sm:grid-cols-2 gap-6 mt-8 pt-6 border-t border-gray-100">{[['Location','Miyapur Industrial Area, Hyderabad'],['Contact','+91 9876543211'],['Operating hours','9 AM - 6 PM, Mon-Sat'],['Rating','4.9 / 5']].map(([x,y])=><div key={x}><p className="text-xs uppercase tracking-wide text-gray-400">{x}</p><p className="font-medium mt-2">{y}</p></div>)}</div><h3 className="font-bold mt-8">Accepted materials</h3><div className="flex flex-wrap gap-2 mt-3">{mockRecyclers[0].acceptedMaterials.map(x=><span key={x} className="badge-primary">{x}</span>)}</div></div><RecyclerLocationManager/></div>:<div className="card p-8">Select an item from the sidebar to manage this area.</div>}</div></DashboardShell>}
function AdminDashboard(){return <DashboardShell role="admin"><PageHeader title="Platform overview" description="A pulse check on the Kabadiwala Connect ecosystem."/><div className="container-app py-8"><div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-5"><StatCard icon={Users} label="Registered Collectors" value="1,200" trend="14.8%"/><StatCard icon={Building2} label="Verified Recyclers" value="35" tone="blue"/><StatCard icon={Recycle} label="E-Waste Collected" value="156.4K kg" trend="21.2%" tone="amber"/><StatCard icon={CheckCircle2} label="Completed Handovers" value="4,230" tone="violet"/><StatCard icon={CircleDollarSign} label="Platform Transactions" value="₹6.48L" trend="18.4%"/></div><div className="grid lg:grid-cols-3 gap-6 mt-6"><div className="card p-6 lg:col-span-2"><h2 className="font-bold text-lg">E-waste collection growth</h2><p className="text-sm text-gray-500 mt-1">Platform-wide monthly volume</p><MiniChart bars={[40,52,48,61,70,78,89]}/></div><div className="card p-6"><h2 className="font-bold text-lg">Material distribution</h2><DonutChart/></div></div><div className="card p-6 mt-6"><div className="flex items-center justify-between"><div><h2 className="font-bold text-lg">Platform health</h2><p className="text-sm text-gray-500 mt-1">Demo operational snapshot</p></div><span className="badge-success"><Activity size={14} className="mr-1"/>Healthy</span></div><div className="grid sm:grid-cols-3 gap-4 mt-6">{[['Collector verification','92%','emerald'],['Recycler response rate','87%','sky'],['Handover completion','94%','violet']].map(([x,v,c])=><div key={x} className="rounded-xl bg-gray-50 p-4"><p className="text-sm text-gray-500">{x}</p><p className={`text-2xl font-bold mt-2 text-${c}-600`}>{v}</p><div className="h-2 bg-gray-200 rounded-full mt-3"><div className={`h-full rounded-full bg-${c}-500`} style={{width:v}}/></div></div>)}</div></div></div></DashboardShell>}
function AdminPage({type}:{type:string}){const pages: Record<string, React.ReactNode>={collectors:<AdminCollectorsPage/>,recyclers:<AdminRecyclersPage/>,materials:<AdminMaterialsPage/>,requests:<AdminRequestsPage/>,transactions:<AdminTransactionsPage/>,reports:<AdminReportsPage/>,notifications:<AdminNotificationsPage/>,settings:<AdminSettingsPage/>}; return <DashboardShell role="admin">{pages[type] ?? <AdminDashboardPage/>}</DashboardShell>}
function Login() {
  const router = useRouter()
  const { login } = useAuth()
  const [role, setRole] = useState<'collector' | 'recycler' | 'admin'>('collector')
  const [email, setEmail] = useState('collector@demo.com')
  const [password, setPassword] = useState('DemoPassword123!')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRoleChange = (newRole: 'collector' | 'recycler' | 'admin') => {
    setRole(newRole)
    setError(null)
    if (newRole === 'collector') {
      setEmail('collector@demo.com')
      setPassword('DemoPassword123!')
    } else if (newRole === 'recycler') {
      setEmail('recycler@demo.com')
      setPassword('DemoPassword123!')
    } else {
      setEmail('admin@demo.com')
      setPassword('DemoPassword123!')
    }
  }

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const loggedUser = await login({ email: email.trim(), password })
      router.push(`/${loggedUser.role}/dashboard`)
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickDemo = async (demoRole: 'collector' | 'recycler' | 'admin') => {
    handleRoleChange(demoRole)
    setError(null)
    setLoading(true)
    const creds = {
      collector: { email: 'collector@demo.com', password: 'DemoPassword123!' },
      recycler: { email: 'recycler@demo.com', password: 'DemoPassword123!' },
      admin: { email: 'admin@demo.com', password: 'DemoPassword123!' },
    }[demoRole]

    try {
      const loggedUser = await login(creds)
      router.push(`/${loggedUser.role}/dashboard`)
    } catch (err: any) {
      setError(err.message || 'Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="hidden lg:flex bg-slate-950 text-white p-12 flex-col justify-between">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-xl">
              <Leaf className="text-emerald-400" />Kabadiwala Connect
            </Link>
            <h1 className="text-4xl font-bold mt-20 leading-tight">Welcome back to the network.</h1>
            <p className="text-slate-400 mt-5 leading-relaxed">
              Every login takes us one step closer to a more transparent and sustainable recycling ecosystem.
            </p>
          </div>
          <div className="flex items-center gap-3 text-emerald-400 text-sm">
            <ShieldCheck size={18} />Secure HttpOnly Cookie Authentication
          </div>
        </div>

        <div className="p-7 md:p-12">
          <div className="flex items-center justify-between lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
              <Leaf size={20} />Kabadiwala Connect
            </Link>
            <span className="badge-primary">Smart India Hackathon</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Sign in to your portal</h2>
          <p className="text-sm text-gray-500 mt-1">Select your role to access your verified dashboard.</p>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex gap-2 mt-7 p-1 bg-gray-100 rounded-xl">
            {(['collector', 'recycler', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition ${
                  role === r ? 'bg-white shadow text-slate-900' : 'text-gray-500'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin}>
            <label className="block text-sm font-medium mt-7">
              Email or phone
              <input
                className="form-input mt-2"
                type="text"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label className="block text-sm font-medium mt-4">
              Password
              <input
                className="form-input mt-2"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>

            <div className="flex items-center justify-between mt-4 text-sm">
              <label className="flex items-center gap-2 text-gray-600">
                <input type="checkbox" defaultChecked />Remember me
              </label>
              <button type="button" className="text-primary font-semibold">Forgot password?</button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-7 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'} <ArrowRight size={17} className="ml-2" />
            </button>
          </form>

          <div className="relative my-7">
            <div className="border-t border-gray-200" />
            <span className="absolute inset-x-0 -top-2.5 text-center">
              <span className="bg-white px-3 text-xs text-gray-400">quick demo access</span>
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['collector', 'recycler', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                disabled={loading}
                onClick={() => handleQuickDemo(r)}
                className="btn-outline text-xs capitalize"
              >
                {r}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-3">
            Demo password: <span className="font-mono text-slate-600 font-medium">DemoPassword123!</span>
          </p>

          <p className="text-sm text-gray-500 text-center mt-6">
            New here? <Link href="/register" className="text-primary font-semibold">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function Register() {
  const router = useRouter()
  const { register } = useAuth()
  const [role, setRole] = useState<'collector' | 'recycler'>('collector')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Form fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('Hyderabad')

  // Recycler specific fields
  const [businessName, setBusinessName] = useState('')
  const [registrationId, setRegistrationId] = useState('')

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (role === 'collector') {
        const u = await register({
          name: name.trim(),
          email: email.trim(),
          password,
          role: 'collector',
          phone: phone.trim() || undefined,
          address: location.trim() || undefined,
        })
        router.push(`/${u.role}/dashboard`)
      } else {
        const u = await register({
          name: name.trim() || businessName.trim(),
          email: email.trim(),
          password,
          role: 'recycler',
          phone: phone.trim() || undefined,
          businessName: businessName.trim() || name.trim(),
          organizationName: businessName.trim() || name.trim(),
          registrationId: registrationId.trim() || `REG-${Date.now().toString().slice(-6)}`,
          address: location.trim() || undefined,
          acceptedMaterials: ['Computers & Laptops', 'Mobile Phones', 'Batteries', 'Cables & Wires'],
        })
        router.push(`/${u.role}/dashboard`)
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check the information provided.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-sky-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-xl p-7 md:p-12">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
          <Leaf size={20} />Kabadiwala Connect
        </Link>
        <h1 className="text-3xl font-bold mt-8">Create your account</h1>
        <p className="text-gray-500 mt-2">Join the formal e-waste recycling ecosystem.</p>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-3 mt-8">
          {(['collector', 'recycler'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => { setRole(r); setError(null); }}
              className={`flex-1 p-4 rounded-xl border text-left transition ${
                role === r ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-semibold capitalize">{r}</p>
              <p className="text-xs text-gray-500 mt-1">
                {r === 'collector' ? 'Collect & earn' : 'Process responsibly'}
              </p>
            </button>
          ))}
        </div>

        <form onSubmit={handleRegister} className="mt-7">
          <div className="grid sm:grid-cols-2 gap-4">
            {role === 'collector' ? (
              <>
                <label className="text-sm font-medium">
                  Full name
                  <input
                    className="form-input mt-2"
                    placeholder="e.g. Ravi Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Phone
                  <input
                    className="form-input mt-2"
                    placeholder="+91 9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium">
                  Email
                  <input
                    className="form-input mt-2"
                    type="email"
                    placeholder="ravi@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Location / City
                  <input
                    className="form-input mt-2"
                    placeholder="Hyderabad"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <>
                <label className="text-sm font-medium">
                  Organization name
                  <input
                    className="form-input mt-2"
                    placeholder="e.g. GreenCycle Recycling"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Contact person
                  <input
                    className="form-input mt-2"
                    placeholder="e.g. Ananya Rao"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Registration ID
                  <input
                    className="form-input mt-2"
                    placeholder="GR-HYD-2026-001"
                    value={registrationId}
                    onChange={(e) => setRegistrationId(e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Phone
                  <input
                    className="form-input mt-2"
                    placeholder="+91 9876543211"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="text-sm font-medium">
                  Email
                  <input
                    className="form-input mt-2"
                    type="email"
                    placeholder="info@greencycle.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="text-sm font-medium">
                  Location / City
                  <input
                    className="form-input mt-2"
                    placeholder="Hyderabad"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </label>
              </>
            )}
            <label className="text-sm font-medium sm:col-span-2">
              Password
              <input
                className="form-input mt-2"
                type="password"
                placeholder="Create a secure password (min 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-8 disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create account'} <ArrowRight size={17} className="ml-2" />
          </button>
        </form>

        <p className="text-sm text-gray-500 text-center mt-6">
          Already registered? <Link href="/login" className="text-primary font-semibold">Sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function KabadiwalaApp(){const pathname=usePathname(); const clean=pathname.replace(/^\//,''); const parts=clean.split('/'); if(parts[0]==='recyclers' && parts[1]) return <WorkflowRoute kind="recycler-details" id={parts[1]}/>; if(parts[0]==='collector' && parts[1]==='requests' && parts[2]) return <WorkflowRoute kind="collector-requests" id={parts[2]}/>; if((parts[0]==='collector' || parts[0]==='recycler') && parts[1]==='handover' && parts[2]) return <WorkflowRoute kind="handover" id={parts[2]}/>; if(parts[0]==='recycler' && parts[1]==='requests' && parts[2]) return <WorkflowRoute kind="recycler-requests" id={parts[2]}/>; if(parts[0]==='collector' && parts[1]==='requests') return <WorkflowRoute kind="collector-requests"/>; if(parts[0]==='recycler' && parts[1]==='requests') return <WorkflowRoute kind="recycler-requests"/>; if(!clean)return <HomePage/>; if(clean==='login')return <Login/>; if(clean.startsWith('register'))return <Register/>; if(clean==='about'||clean==='how-it-works'||clean==='materials'||clean==='recyclers'||clean==='contact')return <PublicPage type={clean}/>; if(clean==='collector/dashboard')return <CollectorDashboard/>; if(clean==='collector/add-waste')return <AddWaste/>; if(clean==='collector/ai-assistant')return <KabiAI/>; if(clean.startsWith('collector/'))return <CollectorPage type={clean.split('/')[1]}/>; if(clean==='recycler/dashboard')return <RecyclerDashboard/>; if(clean.startsWith('recycler/'))return <RecyclerPage type={clean.split('/')[1]}/>; if(clean==='admin/dashboard')return <AdminDashboard/>; if(clean.startsWith('admin/'))return <AdminPage type={clean.split('/')[1]}/>; return <HomePage/> }

export { HomePage }

import { Globe } from 'lucide-react'
