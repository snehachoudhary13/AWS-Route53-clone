"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { removeAuthToken, apiFetch } from "@/lib/api"
import { useTheme } from "@/hooks/use-theme"
import {
  Search,
  Bell,
  HelpCircle,
  Settings,
  Globe,
  Grid,
  Terminal,
  LogOut,
  ChevronDown,
  Sun,
  Moon,
  Copy,
  Check,
  Building2,
  CreditCard,
  Key,
  Layers,
  ArrowRightLeft,
} from "lucide-react"

export function Navbar() {
  const router = useRouter()
  const { toggleTheme, isDark } = useTheme()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [currentUser, setCurrentUser] = useState<{ username: string; id: number } | null>(null)
  const [accountId, setAccountId] = useState("818007713524")

  useEffect(() => {
    // Fetch authenticated user from SQLite /api/auth/me
    apiFetch<{ username: string; id: number }>("/auth/me")
      .then((data) => setCurrentUser(data))
      .catch(() => {})

    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aws_account_id")
      if (stored) setAccountId(stored)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api"}/auth/logout`, {
        method: "POST",
      })
    } catch {
      // Ignore network errors during logout
    } finally {
      removeAuthToken()
      setDropdownOpen(false)
      router.push("/login")
      router.refresh()
    }
  }

  const handleCopyAccount = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(accountId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <header className="h-10 bg-[#0f1b2a] text-white flex items-center justify-between px-3 border-b border-[#19212c] sticky top-0 z-50 text-xs select-none">
        {/* Left: AWS Mark & Search */}
        <div className="flex items-center space-x-3">
          {/* AWS Logo */}
          <div className="flex items-center space-x-1 cursor-pointer" onClick={() => router.push("/dashboard")}>
            <div className="bg-[#ff9900] text-black font-extrabold px-1.5 py-0.5 rounded text-[11px] tracking-wider leading-none">
              aws
            </div>
          </div>

          {/* Service Switcher Icon */}
          <button className="text-gray-300 hover:text-white p-1 rounded hover:bg-[#16191f]" title="Services">
            <Grid className="w-4 h-4 text-purple-400" />
          </button>

          {/* Search Bar */}
          <div className="relative w-56 sm:w-64 md:w-80 lg:w-96">
            <div className="flex items-center bg-[#16191f] text-gray-300 rounded border border-gray-700 px-2.5 py-1 focus-within:border-[#0972d3]">
              <Search className="w-3.5 h-3.5 text-gray-400 mr-2 shrink-0" />
              <input
                id="global-navbar-search"
                type="text"
                placeholder="Search"
                className="bg-transparent text-xs text-white placeholder-gray-400 focus:outline-none w-full"
              />
              <span className="text-[10px] bg-gray-800 text-gray-400 border border-gray-700 rounded px-1.5 py-0.5 ml-1 shrink-0 font-mono hidden sm:inline">
                /
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="text-gray-300 hover:text-white p-1.5 hover:bg-[#16191f] rounded transition-colors"
            title={`Switch to ${isDark ? "Light" : "Dark"} mode`}
          >
            {isDark ? (
              <Sun className="w-3.5 h-3.5 text-yellow-400" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-gray-300" />
            )}
          </button>

          <button className="text-gray-300 hover:text-white p-1.5 hover:bg-[#16191f] rounded hidden sm:block" title="CloudShell">
            <Terminal className="w-3.5 h-3.5 text-[#ff9900]" />
          </button>
          <button className="text-gray-300 hover:text-white p-1.5 hover:bg-[#16191f] rounded hidden sm:block" title="Notifications">
            <Bell className="w-3.5 h-3.5" />
          </button>
          <button className="text-gray-300 hover:text-white p-1.5 hover:bg-[#16191f] rounded hidden md:block" title="Help">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button className="text-gray-300 hover:text-white p-1.5 hover:bg-[#16191f] rounded hidden md:block" title="Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>

          {/* Region Selector */}
          <div className="hidden lg:flex items-center text-gray-300 hover:text-white px-2 py-1 cursor-pointer rounded hover:bg-[#16191f] font-medium">
            <Globe className="w-3.5 h-3.5 mr-1 text-gray-400" />
            <span>Global</span>
            <ChevronDown className="w-3 h-3 ml-1 text-gray-400" />
          </div>

          {/* User Account / IAM Menu */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-1.5 text-gray-200 hover:text-white bg-[#16191f] hover:bg-[#1f2530] px-2.5 py-1 rounded border border-gray-700 transition-colors"
            >
              <span className="font-medium truncate max-w-[130px] sm:max-w-[200px]">
                {currentUser ? `${currentUser.username} @ ${accountId}` : `admin @ ${accountId}`}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-[#16212e] text-gray-900 dark:text-gray-100 rounded shadow-2xl border border-gray-200 dark:border-gray-700 py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-150">
                {/* Account & IAM User Banner */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-[#121c27]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900 dark:text-gray-100 text-xs">
                      {currentUser?.username || "admin"}
                    </span>
                    <span className="text-[10px] bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-300 px-1.5 py-0.5 rounded font-mono font-semibold">
                      IAM: Administrator
                    </span>
                  </div>

                  {/* Account ID with copy button */}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400 font-mono bg-white dark:bg-[#16212e] px-2 py-1 rounded border border-gray-200 dark:border-gray-700">
                    <span>Account ID: <strong>{accountId}</strong></span>
                    <button
                      onClick={handleCopyAccount}
                      className="text-[#0972d3] dark:text-[#42a5f5] hover:text-blue-700 p-0.5"
                      title="Copy Account ID"
                    >
                      {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Organization */}
                  <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                    <Building2 className="w-3 h-3 text-gray-400" />
                    <span>Organization: <strong className="text-gray-700 dark:text-gray-300">o-awsroute53org</strong></span>
                  </div>
                </div>

                {/* Mocked AWS Navigation Links */}
                <div className="py-1 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-700 dark:text-gray-300">
                  <div className="px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-gray-400" />
                    <span>Account settings</span>
                  </div>
                  <div className="px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" />
                    <span>AWS Organizations</span>
                  </div>
                  <div className="px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                    <span>Billing and Cost Management</span>
                  </div>
                  <div className="px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer flex items-center gap-2">
                    <Key className="w-3.5 h-3.5 text-gray-400" />
                    <span>Security credentials</span>
                  </div>
                  <div className="px-4 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer flex items-center gap-2 text-[#0972d3] dark:text-[#42a5f5] font-semibold">
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>Switch Role</span>
                  </div>
                </div>

                {/* Theme Switcher */}
                <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Appearance</span>
                  <button
                    onClick={toggleTheme}
                    className="text-xs font-semibold text-[#0972d3] dark:text-[#42a5f5] hover:underline"
                  >
                    {isDark ? "Switch to Light" : "Switch to Dark"}
                  </button>
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 font-medium transition-colors text-xs"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out ({currentUser?.username || "admin"})</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  )
}

export default Navbar
