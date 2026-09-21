'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, Leaf } from 'lucide-react'
import { useState } from 'react'

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()

  const isActive = (href: string) => pathname === href

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="container-app">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-primary hover:text-primary-dark transition">
            <Leaf size={24} />
            <span className="hidden sm:inline">Kabadiwala Connect</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className={`text-sm font-medium transition ${isActive('/') ? 'text-primary' : 'text-gray-700 hover:text-gray-900'}`}>
              Home
            </Link>
            <Link href="/how-it-works" className={`text-sm font-medium transition ${isActive('/how-it-works') ? 'text-primary' : 'text-gray-700 hover:text-gray-900'}`}>
              How It Works
            </Link>
            <Link href="/materials" className={`text-sm font-medium transition ${isActive('/materials') ? 'text-primary' : 'text-gray-700 hover:text-gray-900'}`}>
              Materials
            </Link>
            <Link href="/recyclers" className={`text-sm font-medium transition ${isActive('/recyclers') ? 'text-primary' : 'text-gray-700 hover:text-gray-900'}`}>
              Recyclers
            </Link>
            <Link href="/about" className={`text-sm font-medium transition ${isActive('/about') ? 'text-primary' : 'text-gray-700 hover:text-gray-900'}`}>
              About
            </Link>
            <Link href="/contact" className={`text-sm font-medium transition ${isActive('/contact') ? 'text-primary' : 'text-gray-700 hover:text-gray-900'}`}>
              Contact
            </Link>
          </div>

          {/* Auth Buttons */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="btn-ghost">
              Login
            </Link>
            <Link href="/register" className="btn-primary">
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 hover:bg-gray-100 rounded-lg transition"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col gap-3">
              <Link href="/" className="px-4 py-2 hover:bg-gray-50 rounded transition">Home</Link>
              <Link href="/how-it-works" className="px-4 py-2 hover:bg-gray-50 rounded transition">How It Works</Link>
              <Link href="/materials" className="px-4 py-2 hover:bg-gray-50 rounded transition">Materials</Link>
              <Link href="/recyclers" className="px-4 py-2 hover:bg-gray-50 rounded transition">Recyclers</Link>
              <Link href="/about" className="px-4 py-2 hover:bg-gray-50 rounded transition">About</Link>
              <Link href="/contact" className="px-4 py-2 hover:bg-gray-50 rounded transition">Contact</Link>
              <div className="border-t border-gray-200 pt-3 flex flex-col gap-2">
                <Link href="/login" className="btn-secondary w-full justify-center">Login</Link>
                <Link href="/register" className="btn-primary w-full justify-center">Get Started</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
