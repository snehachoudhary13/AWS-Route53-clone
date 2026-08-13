"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { apiFetch, getAuthToken, removeAuthToken } from "@/lib/api"
import Navbar from "./Navbar"
import Sidebar from "./Sidebar"
import Footer from "./Footer"
import { Toaster } from "@/components/ui/toaster"
import { useTheme } from "@/hooks/use-theme"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { ChevronRight, Info, Menu } from "lucide-react"

// ── Segment label resolver ──────────────────────────────────────────────────
function resolveSegmentLabel(segment: string, prevSegment: string | undefined): string {
  if (segment === "hosted-zones") {
    return "Hosted zones"
  }
  if (/^\d+$/.test(segment) && prevSegment === "hosted-zones") {
    return "Hosted zone"
  }
  return segment
    .split("-")
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w.toLowerCase()))
    .join(" ")
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleTheme } = useTheme()
  const isCreateRecordPage = pathname.includes("/create-record")
  const [sidebarOpen, setSidebarOpen] = useState(!isCreateRecordPage)

  // Update sidebar state if route changes
  useEffect(() => {
    if (pathname.includes("/create-record")) {
      setSidebarOpen(false)
    } else {
      setSidebarOpen(true)
    }
  }, [pathname])

  // Validate session against /api/auth/me on non-login routes
  useEffect(() => {
    if (pathname === "/login") return
    const token = getAuthToken()
    if (!token) {
      router.push("/login")
      return
    }

    apiFetch<{ username: string; user_id: number; is_active: boolean }>("/auth/me").catch(() => {
      removeAuthToken()
      router.push("/login")
    })
  }, [pathname, router])

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "d",
      description: "Toggle Dark mode",
      action: () => toggleTheme(),
    },
  ])

  // Login page — no console chrome
  if (pathname === "/login") {
    return (
      <div className="min-h-screen bg-[#f2f3f3] dark:bg-[#0f1b2a] text-[#16191f] dark:text-gray-100 flex flex-col">
        {children}
        <Toaster />
      </div>
    )
  }

  const pathSegments = pathname.split("/").filter(Boolean)

  const renderBreadcrumbs = () => {
    if (pathSegments.length === 0) {
      return (
        <div className="flex items-center space-x-1.5 text-xs text-[#5f6b7a] dark:text-gray-400">
          <Link href="/dashboard" className="text-[#0972d3] font-medium hover:underline cursor-pointer">Route 53</Link>
          <ChevronRight className="w-3.5 h-3.5 text-[#5f6b7a] dark:text-gray-500" />
          <span className="text-[#16191f] dark:text-gray-200 font-normal">Dashboard</span>
        </div>
      )
    }

    return (
      <div className="flex items-center space-x-1.5 text-xs">
        <Link href="/dashboard" className="text-[#0972d3] font-medium hover:underline cursor-pointer">
          Route 53
        </Link>
        {pathSegments.map((segment, idx) => {
          const isLast = idx === pathSegments.length - 1
          const prevSegment = idx > 0 ? pathSegments[idx - 1] : undefined
          const label = resolveSegmentLabel(segment, prevSegment)
          
          let href = `/${pathSegments.slice(0, idx + 1).join("/")}`
          if (segment === "create-record") {
            href = `/${pathSegments.slice(0, idx).join("/")}`
          }

          return (
            <div key={`${segment}-${idx}`} className="flex items-center space-x-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-[#5f6b7a] dark:text-gray-500" />
              {isLast ? (
                <span className="text-[#16191f] dark:text-gray-200 font-normal">{label}</span>
              ) : (
                <Link href={href} className="text-[#0972d3] font-medium hover:underline cursor-pointer">
                  {label}
                </Link>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#eaeded] dark:bg-[#0f1b2a] text-[#16191f] dark:text-gray-100 font-sans transition-colors duration-150">
      <Navbar />

      {/* Sub-header breadcrumb bar */}
      <div className="h-9 bg-[#e9ebed] dark:bg-[#16212e] border-b border-[#d5dbdb] dark:border-[#2a3747] px-3 flex items-center justify-between text-xs sticky top-10 z-40 select-none">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-[#5f6b7a] dark:text-gray-400 hover:text-[#16191f] dark:hover:text-white p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700"
            title="Toggle Sidebar"
          >
            <Menu className="w-4 h-4 text-[#0972d3]" />
          </button>
          {renderBreadcrumbs()}
        </div>

        <button className="text-[#5f6b7a] dark:text-gray-400 hover:text-[#16191f] dark:hover:text-white p-1 rounded hover:bg-gray-300 dark:hover:bg-gray-700 flex items-center gap-1 text-xs">
          <Info className="w-4 h-4 text-[#5f6b7a] dark:text-gray-400" />
        </button>
      </div>

      {/* Console main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && <Sidebar />}

        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          <main className="flex-1 p-6 max-w-[1400px] w-full mx-auto">
            {children}
          </main>
          <Footer />
        </div>
      </div>

      <Toaster />
    </div>
  )
}
