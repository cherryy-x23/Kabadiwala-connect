'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import { LucideIcon } from 'lucide-react'

export interface DashboardLayoutProps {
  children: ReactNode
  items: Array<{
    icon: LucideIcon
    label: string
    href: string
  }>
  userRole: 'collector' | 'recycler' | 'admin'
  userName: string
}

export default function DashboardLayout({
  children,
  items,
  userRole,
  userName,
}: DashboardLayoutProps) {
  const sidebarItems = items.map(item => ({
    icon: <item.icon size={20} />,
    label: item.label,
    href: item.href,
  }))

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar items={sidebarItems} userRole={userRole} userName={userName} />

      {/* Main Content */}
      <main className="flex-1 md:ml-64 overflow-auto">
        {children}
      </main>
    </div>
  )
}
