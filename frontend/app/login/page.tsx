"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { setAuthToken, API_BASE_URL } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { Lock, User, AlertCircle, Shield, Building2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [userType, setUserType] = useState<"root" | "iam">("root")
  const [accountId, setAccountId] = useState("818007713524")
  const [username, setUsername] = useState("admin")
  const [password, setPassword] = useState("password123")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const body = new URLSearchParams()
      body.append("username", username.trim())
      body.append("password", password)

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || "Authentication failed. Invalid username or password.")
      }

      const data = await response.json()
      if (data.access_token) {
        setAuthToken(data.access_token)
        if (typeof window !== "undefined") {
          localStorage.setItem("aws_account_id", accountId || "818007713524")
          localStorage.setItem("aws_user_type", userType)
        }
        router.push("/hosted-zones")
        router.refresh()
      } else {
        throw new Error("Invalid token received from server")
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to sign in. Please check your credentials."
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleInertAction = (actionName: string) => {
    toast({
      title: `${actionName} unavailable`,
      description: "This feature is simulated in the Route 53 demo console.",
    })
  }

  return (
    <div className="min-h-screen bg-[#f2f3f3] dark:bg-[#0f1b2a] flex flex-col justify-between font-sans transition-colors duration-150">
      {/* Top AWS Header Bar */}
      <header className="bg-[#232f3e] text-white h-12 px-6 flex items-center justify-between border-b border-[#19212c] select-none">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 cursor-pointer">
            <div className="bg-[#ff9900] text-black font-extrabold px-1.5 py-0.5 rounded text-[11px] tracking-wider leading-none">
              aws
            </div>
            <span className="font-semibold text-xs text-gray-200 tracking-wide">
              Management Console
            </span>
          </div>
        </div>

        <div className="text-xs text-gray-300 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-[#ff9900]" />
          <span className="text-[11px] text-gray-300 font-medium">Route 53 Authentication</span>
        </div>
      </header>

      {/* Main Sign-in Card */}
      <main className="flex-1 flex items-center justify-center p-4 my-6">
        <div className="w-full max-w-[440px] bg-white dark:bg-[#16212e] border border-[#d5dbdb] dark:border-[#2a3747] shadow-md rounded-xs p-8 text-[#16191f] dark:text-gray-100 transition-colors">
          
          {/* Header Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
              Sign in
            </h1>
            <p className="text-xs text-[#5f6b7a] dark:text-gray-400 mt-1">
              Access your Route 53 DNS resources and hosted zones.
            </p>
          </div>

          {/* Real Backend Error Alert */}
          {error && (
            <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-xs text-xs text-red-800 dark:text-red-200 flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
              <div>
                <strong className="font-bold">Authentication failed</strong>
                <p className="mt-0.5 leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* User Type Selection (Radio) */}
            <div className="space-y-2 pb-2 border-b border-[#eaeded] dark:border-gray-800">
              <label className="block text-xs font-bold text-[#16191f] dark:text-gray-200">
                User type
              </label>
              
              <div className="space-y-2 text-xs">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="userType"
                    value="root"
                    checked={userType === "root"}
                    onChange={() => setUserType("root")}
                    className="mt-0.5 text-[#0972d3] focus:ring-[#0972d3]"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">Root user</span>
                    <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400 leading-tight">
                      Account owner with complete access to Route 53 resources.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="userType"
                    value="iam"
                    checked={userType === "iam"}
                    onChange={() => setUserType("iam")}
                    className="mt-0.5 text-[#0972d3] focus:ring-[#0972d3]"
                  />
                  <div>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">IAM user</span>
                    <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400 leading-tight">
                      User within an AWS account ID with assigned IAM permissions.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* AWS Account ID for IAM */}
            {userType === "iam" && (
              <div>
                <label className="block text-xs font-bold text-[#16191f] dark:text-gray-200 mb-1">
                  AWS Account ID (12 digits)
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
                    <Building2 className="w-3.5 h-3.5" />
                  </span>
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    placeholder="818007713524"
                    maxLength={12}
                    className="w-full pl-8 pr-3 py-1.5 text-xs font-mono border border-gray-400 dark:border-gray-700 bg-white dark:bg-[#121c27] text-gray-900 dark:text-gray-100 rounded-xs focus:outline-none focus:border-[#0972d3] focus:ring-1 focus:ring-[#0972d3]"
                  />
                </div>
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-xs font-bold text-[#16191f] dark:text-gray-200 mb-1">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
                  <User className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-400 dark:border-gray-700 bg-white dark:bg-[#121c27] text-gray-900 dark:text-gray-100 rounded-xs focus:outline-none focus:border-[#0972d3] focus:ring-1 focus:ring-[#0972d3]"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-[#16191f] dark:text-gray-200">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => handleInertAction("Password reset")}
                  className="text-[11px] text-[#0972d3] dark:text-[#42a5f5] hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-gray-400">
                  <Lock className="w-3.5 h-3.5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-400 dark:border-gray-700 bg-white dark:bg-[#121c27] text-gray-900 dark:text-gray-100 rounded-xs focus:outline-none focus:border-[#0972d3] focus:ring-1 focus:ring-[#0972d3]"
                />
              </div>
            </div>

            {/* Sign in Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white font-bold text-xs py-2 px-4 rounded-full shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Authenticating…</span>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </form>

          {/* Bottom helper */}
          <div className="mt-6 pt-4 border-t border-[#eaeded] dark:border-gray-800 text-center">
            <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400">
              Need help signing in?{" "}
              <button
                type="button"
                onClick={() => handleInertAction("Support Center")}
                className="text-[#0972d3] dark:text-[#42a5f5] hover:underline"
              >
                AWS Support Center
              </button>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[11px] text-[#5f6b7a] dark:text-gray-500 border-t border-[#eaeded] dark:border-gray-800 space-x-4">
        <span onClick={() => handleInertAction("Terms of Use")} className="cursor-pointer hover:underline">Terms of Use</span>
        <span>·</span>
        <span onClick={() => handleInertAction("Privacy Notice")} className="cursor-pointer hover:underline">Privacy Notice</span>
        <span>·</span>
        <span>© 2026, Amazon Web Services, Inc. or its affiliates.</span>
      </footer>
    </div>
  )
}
