'use client'

import { ArrowUpRight, LucideIcon } from 'lucide-react'

export function StatCard({ icon: Icon, label, value, trend, tone = 'primary' }: { icon: LucideIcon; label: string; value: string; trend?: string; tone?: string }) {
  const tones: Record<string, string> = {
    primary: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  }

  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`rounded-xl p-3 ${tones[tone] || tones.primary}`}><Icon size={22} /></div>
        {trend && <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><ArrowUpRight size={14} />{trend}</span>}
      </div>
      <p className="mt-5 text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export function MiniChart({ bars = [44, 65, 42, 72, 59, 84, 68] }: { bars?: number[] }) {
  return (
    <div className="flex h-44 items-end gap-3 px-2 pt-6">
      {bars.map((value, index) => (
        <div key={`${value}-${index}`} className="flex flex-1 flex-col items-center justify-end gap-2">
          <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all hover:from-emerald-700 hover:to-emerald-500" style={{ height: `${value}%` }} />
          <span className="text-[11px] text-gray-400">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][index]}</span>
        </div>
      ))}
    </div>
  )
}

export function DonutChart() {
  return (
    <div className="relative mx-auto size-44">
      <div className="size-full rounded-full" style={{ background: 'conic-gradient(#059669 0 29%, #0ea5e9 29% 48%, #f59e0b 48% 68%, #8b5cf6 68% 86%, #d1d5db 86% 100%)' }} />
      <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-bold text-gray-900">1,284</span><span className="text-xs text-gray-500">kg total</span></div>
    </div>
  )
}
