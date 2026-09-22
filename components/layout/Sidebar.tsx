'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LogOut, Menu, X, Leaf } from 'lucide-react'
import { useState, useEffect } from 'react'
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

  // Prevent background scrolling when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      setIsOpen(false)
      router.push('/login')
    }
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/')

  return (
    <>
      {/* Mobile Floating Menu Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed z-30 p-3 bg-primary text-white rounded-full shadow-lg hover:bg-primary-dark transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        style={{
          right: '1.5rem',
          bottom: 'max(1.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem))',
        }}
        aria-label={isOpen ? 'Close menu' : 'Open menu'}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Desktop Sidebar (unchanged desktop behavior) */}
      <div className="hidden md:flex w-64 h-screen bg-white border-r border-gray-200 flex-col fixed left-0 top-0 z-40">
        {/* Desktop Logo */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <Link href="/" className="flex items-center gap-2 font-bold text-primary hover:text-primary-dark transition">
            <Leaf size={20} />
            <span className="text-sm font-semibold text-gray-900">Kabadiwala</span>
          </Link>
        </div>

        {/* Desktop User Profile */}
        <div className="p-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold">
              <span>{userName[0]?.toUpperCase() || 'U'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500 capitalize">{userRole}</p>
            </div>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="space-y-1">
            {items.map((item) => {
              const isNotifications = item.label.toLowerCase() === 'notifications' || item.href.includes('/notifications')
              return (
                <Link
                  key={item.href}
                  href={item.href}
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

        {/* Desktop Logout */}
        <div className="p-4 border-t border-gray-200 shrink-0">
          <button
            onClick={handleLogout}
            className="sidebar-nav-item w-full justify-start hover:text-danger"
          >
            <LogOut size={20} />
            <span className="flex-1">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <>
          {/* Backdrop overlay (80–90% width leaves overlay reachable) */}
          <div
            onClick={() => setIsOpen(false)}
            className="drawer-overlay md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
            aria-hidden="true"
          />

          {/* Mobile Drawer Content */}
          <aside
            className={`drawer-content md:hidden ${isOpen ? 'open' : 'closed'}`}
            style={{
              height: '100dvh',
              maxHeight: '100dvh',
              width: 'min(85vw, 20rem)',
            }}
            aria-label="Mobile Navigation Drawer"
          >
            {/* 1. Header (Logo + Close Button) */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0 bg-white">
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 font-bold text-primary hover:text-primary-dark transition"
              >
                <Leaf size={20} />
                <span className="text-sm font-bold text-gray-900">Kabadiwala</span>
              </Link>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            {/* 2. User Profile Section */}
            <div className="p-4 border-b border-gray-200 shrink-0 bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold">
                  <span>{userName[0]?.toUpperCase() || 'U'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
              </div>
            </div>

            {/* 3. Scrollable Navigation Section */}
            <nav className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain">
              <div className="space-y-1">
                {items.map((item) => {
                  const isNotifications =
                    item.label.toLowerCase() === 'notifications' ||
                    item.href.includes('/notifications')
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`sidebar-nav-item ${isActive(item.href) ? 'active' : ''}`}
                    >
                      {item.icon}
                      <span className="flex-1 text-sm font-medium">{item.label}</span>
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

            {/* 4. Sticky / Pinned Bottom Action Area (Logout is ALWAYS accessible) */}
            <div
              className="p-4 border-t border-gray-200 bg-white shrink-0 shadow-xs"
              style={{
                paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))',
              }}
            >
              <button
                onClick={handleLogout}
                className="sidebar-nav-item w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 transition font-medium"
              >
                <LogOut size={20} className="shrink-0" />
                <span className="flex-1 text-left">Logout</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  )
}
