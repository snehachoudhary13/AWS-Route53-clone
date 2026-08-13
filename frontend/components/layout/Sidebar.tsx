"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, ChevronLeft } from "lucide-react"

interface SidebarGroupProps {
  title: string
  items: { name: string; href: string; isNew?: boolean; disabled?: boolean }[]
  pathname: string
}

function SidebarGroup({ title, items, pathname }: SidebarGroupProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="py-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center px-3 py-1 text-xs font-bold text-[#16191f] dark:text-gray-200 hover:text-gray-900 dark:hover:text-white select-none"
      >
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 mr-1.5 text-[#5f6b7a] dark:text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 mr-1.5 text-[#5f6b7a] dark:text-gray-400 shrink-0" />
        )}
        <span>{title}</span>
      </button>

      {open && (
        <div className="pl-6 pr-2 space-y-0.5 mt-0.5">
          {items.map((item) => {
            const isActive = !item.disabled && pathname === item.href
            return item.disabled ? (
              <span
                key={item.name}
                className="flex items-center justify-between px-2 py-1 text-xs rounded text-[#879596] dark:text-gray-500 cursor-not-allowed select-none opacity-70"
                title={`${item.name} is simulated in this clone`}
              >
                <span className="truncate">{item.name}</span>
                {item.isNew && (
                  <span className="text-[10px] text-gray-400 font-normal ml-1 shrink-0">
                    New
                  </span>
                )}
              </span>
            ) : (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center justify-between px-2 py-1 text-xs rounded transition-colors ${
                  isActive
                    ? "font-semibold text-[#0972d3] bg-[#e9ebed] dark:bg-gray-800"
                    : "text-[#16191f] dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-[#e9ebed] dark:hover:bg-gray-800"
                }`}
              >
                <span className="truncate">{item.name}</span>
                {item.isNew && (
                  <span className="text-[10px] text-[#0972d3] font-normal underline ml-1 shrink-0">
                    New
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <div className="w-10 bg-[#f2f3f3] dark:bg-[#121c27] border-r border-[#eaeded] dark:border-[#2a3747] flex flex-col items-center py-3 shrink-0 transition-colors">
        <button
          onClick={() => setCollapsed(false)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-[#5f6b7a] dark:text-gray-400"
          title="Expand Navigation"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    )
  }

  // All 6 top-level primary sections
  const mainLinks = [
    { name: "Dashboard",        href: "/dashboard" },
    { name: "Hosted zones",     href: "/hosted-zones" },
    { name: "Traffic policies", href: "/traffic-policies" },
    { name: "Health checks",    href: "/health-checks" },
    { name: "Resolver",         href: "/resolver" },
    { name: "Profiles",         href: "/profiles" },
  ]

  return (
    <aside className="w-60 bg-[#f2f3f3] dark:bg-[#121c27] border-r border-[#eaeded] dark:border-[#2a3747] flex flex-col shrink-0 text-xs text-[#16191f] dark:text-gray-200 select-none overflow-y-auto min-h-[calc(100vh-2.5rem)] transition-colors">
      {/* Title row */}
      <div className="p-3 border-b border-[#eaeded] dark:border-[#2a3747] flex items-center justify-between">
        <span className="font-bold text-sm text-[#16191f] dark:text-gray-100">Route 53</span>
        <button
          onClick={() => setCollapsed(true)}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-[#5f6b7a] dark:text-gray-400"
          title="Collapse Navigation"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Primary navigation */}
      <nav className="py-2 space-y-0.5 border-b border-[#eaeded] dark:border-[#2a3747]">
        {mainLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href === "/hosted-zones" && pathname?.startsWith("/hosted-zones"))
          return (
            <Link
              key={link.name}
              href={link.href}
              className={`block py-1.5 text-xs transition-colors ${
                isActive
                  ? "font-bold text-[#0972d3] bg-[#e9ebed] dark:bg-[#1f2d3d] border-l-[3px] border-[#0972d3] pl-[13px] pr-4"
                  : "text-[#16191f] dark:text-gray-300 hover:bg-[#e9ebed] dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white pl-4 pr-4"
              }`}
            >
              {link.name}
            </Link>
          )
        })}
      </nav>

      {/* Collapsible section groups */}
      <div className="py-2 space-y-2">
        <SidebarGroup
          title="Global Resolver"
          pathname={pathname}
          items={[
            { name: "Global resolvers",  href: "/global-resolvers", isNew: true },
            { name: "Shared DNS views",  href: "#", isNew: true, disabled: true },
          ]}
        />

        <SidebarGroup
          title="VPC Resolver"
          pathname={pathname}
          items={[
            { name: "VPCs",                href: "/vpcs" },
            { name: "Inbound endpoints",   href: "#", disabled: true },
            { name: "Outbound endpoints",  href: "#", disabled: true },
            { name: "Rules",               href: "#", disabled: true },
            { name: "Query logging",       href: "#", disabled: true },
            { name: "Outposts",            href: "#", disabled: true },
          ]}
        />

        <SidebarGroup
          title="Domains"
          pathname={pathname}
          items={[
            { name: "Registered domains", href: "/registered-domains" },
            { name: "Requests",           href: "#", disabled: true },
          ]}
        />

        <SidebarGroup
          title="IP-based routing"
          pathname={pathname}
          items={[
            { name: "CIDR collections", href: "#", disabled: true },
            { name: "CIDR locations",   href: "#", disabled: true },
          ]}
        />
      </div>
    </aside>
  )
}

export default Sidebar
