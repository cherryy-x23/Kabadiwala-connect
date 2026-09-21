'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, Leaf } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/lib/authContext'
import { useNotificationCount } from '@/lib/notificationContext'

interface SidebarItem {
  icon: React.ReactNode
  label: string
  href: string
}

interface SidebarProps {
  items: SidebarItem[]
  userRole: 'collector' | 'recycler' | 'admin'
  userName: string
}

export default function Sidebar({ items, userRole, userName }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { logout } = useAuth()
  const { unreadCount } = useNotificationCount()

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      router.push('/login')
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo Section */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary hover:text-primary-dark transition">
          <Leaf size={20} />
          <span className="hidden sm:inline text-sm">Kabadiwala</span>
        </Link>
        <button onClick={() => setIsOpen(false)} className="md:hidden">
          <X size={20} />
        </button>
      </div>

      {/* User Profile Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-bold">{userName[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
            <p className="text-xs text-gray-500 capitalize">{userRole}</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {items.map((item) => {
            const isNotifications = item.label.toLowerCase() === 'notifications' || item.href.includes('/notifications')
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {isNotifications && unreadCount > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Logout Section */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full justify-start hover:text-danger"
        >
          <LogOut size={20} />
          <span className="flex-1">Logout</span>
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed bottom-6 right-6 z-30 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition"
      >
        <Menu size={24} />
      </button>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 h-screen bg-white border-r border-gray-200 flex-col fixed left-0 top-0 z-40">
        {sidebarContent}
      </div>

      {/* Mobile Sidebar */}
      {isOpen && (
        <>
          <div onClick={() => setIsOpen(false)} className="drawer-overlay md:hidden" />
          <div className={`drawer-content md:hidden ${isOpen ? 'open' : 'closed'}`}>
            <div className="h-screen flex flex-col">{sidebarContent}</div>
          </div>
        </>
      )}
    </>
  )
}
