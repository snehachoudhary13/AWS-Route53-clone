"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { ChevronDown, ChevronRight } from "lucide-react"

export default function CreateHostedZonePage() {
  const router = useRouter()
  const { toast } = useToast()

  const [domainName, setDomainName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<"Public" | "Private">("Public")
  const [tagsOpen, setTagsOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domainName.trim()) {
      toast({ title: "Error", description: "Domain name is required", variant: "destructive" })
      return
    }

    setLoading(true)

    try {
      await apiFetch("/hosted-zones", {
        method: "POST",
        body: JSON.stringify({
          name: domainName.trim(),
          type,
          comment: description.trim() || undefined,
        }),
      })

      toast({
        title: "Successfully created hosted zone",
        description: `Hosted zone for ${domainName} created with auto-seeded DNS records.`,
        variant: "success",
      })

      router.push("/hosted-zones")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create hosted zone"
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Title */}
      <div className="flex items-center space-x-2">
        <h1 className="text-xl font-bold text-gray-900">Create hosted zone</h1>
        <span className="text-[#0972d3] text-xs font-medium cursor-pointer hover:underline">
          Info
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hosted Zone Configuration Card matching Screenshot 2 */}
        <div className="bg-white border border-[#d5dbdb] rounded p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-bold text-gray-900">Hosted zone configuration</h2>
            <p className="text-xs text-gray-600 mt-1">
              A hosted zone is a container that holds information about how you want to route traffic for a domain, such as example.com, and its subdomains.
            </p>
          </div>

          {/* Domain Name Input */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1">
              <label className="text-xs font-bold text-gray-900">Domain name</label>
              <span className="text-[#0972d3] text-xs cursor-pointer hover:underline">Info</span>
            </div>
            <p className="text-xs text-gray-500">This is the name of the domain that you want to route traffic for.</p>
            <input
              type="text"
              required
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              placeholder="example.com"
              className="w-full max-w-2xl bg-white border border-[#0972d3] rounded px-3 py-2 text-xs text-gray-900 focus:outline-none ring-1 ring-[#0972d3]"
            />
            <p className="text-[11px] text-gray-500">
              Valid characters: a-z, 0-9, ! &quot; # $ % &amp; &apos; ( ) * + , - / : ; &lt; = &gt; ? @ [ \ ] ^ _ ` &#123; | &#125; . ~
            </p>
          </div>

          {/* Description Textarea */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1">
              <label className="text-xs font-bold text-gray-900">Description - optional</label>
              <span className="text-[#0972d3] text-xs cursor-pointer hover:underline">Info</span>
            </div>
            <p className="text-xs text-gray-500">This value lets you distinguish hosted zones that have the same name.</p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 256))}
              rows={3}
              placeholder="The hosted zone is used for..."
              className="w-full max-w-2xl bg-white border border-gray-400 rounded px-3 py-2 text-xs text-gray-900 focus:outline-none focus:border-[#0972d3]"
            />
            <p className="text-[11px] text-gray-500">
              The description can have up to 256 characters. {description.length}/256
            </p>
          </div>

          {/* Type Selection Radio Option Cards from Screenshot 2 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1">
              <label className="text-xs font-bold text-gray-900">Type</label>
              <span className="text-[#0972d3] text-xs cursor-pointer hover:underline">Info</span>
            </div>
            <p className="text-xs text-gray-500">
              The type indicates whether you want to route traffic on the internet or in an Amazon VPC.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl pt-1">
              {/* Public Option */}
              <div
                onClick={() => setType("Public")}
                className={`border rounded p-4 cursor-pointer transition-all ${
                  type === "Public"
                    ? "border-[#0972d3] bg-[#f1f8fa] ring-1 ring-[#0972d3]"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="radio"
                    name="zoneType"
                    checked={type === "Public"}
                    onChange={() => setType("Public")}
                    className="mt-0.5 text-[#0972d3] focus:ring-0"
                  />
                  <div>
                    <h3 className="font-bold text-xs text-gray-900 mb-1">Public hosted zone</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      A public hosted zone determines how traffic is routed on the internet.
                    </p>
                  </div>
                </div>
              </div>

              {/* Private Option */}
              <div
                onClick={() => setType("Private")}
                className={`border rounded p-4 cursor-pointer transition-all ${
                  type === "Private"
                    ? "border-[#0972d3] bg-[#f1f8fa] ring-1 ring-[#0972d3]"
                    : "border-gray-300 bg-white hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="radio"
                    name="zoneType"
                    checked={type === "Private"}
                    onChange={() => setType("Private")}
                    className="mt-0.5 text-[#0972d3] focus:ring-0"
                  />
                  <div>
                    <h3 className="font-bold text-xs text-gray-900 mb-1">Private hosted zone</h3>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      A private hosted zone determines how traffic is routed within an Amazon VPC.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tags Section from Screenshot 2 */}
        <div className="bg-white border border-[#d5dbdb] rounded p-6 shadow-sm space-y-3">
          <button
            type="button"
            onClick={() => setTagsOpen(!tagsOpen)}
            className="flex items-center space-x-2 text-xs font-bold text-gray-900"
          >
            {tagsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            <span>Tags</span>
            <span className="text-[#0972d3] font-normal cursor-pointer hover:underline">Info</span>
          </button>

          {tagsOpen && (
            <p className="text-xs text-gray-500 pl-6">
              You can assign tags to hosted zones to help filter and manage AWS resources. (Optional)
            </p>
          )}
        </div>

        {/* Action Buttons Bar from Screenshot 2 */}
        <div className="flex items-center justify-end space-x-4 pt-4 border-t border-[#d5dbdb]">
          <Link
            href="/hosted-zones"
            className="text-[#0972d3] font-bold text-xs hover:underline px-4 py-2"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white font-bold text-xs px-6 py-2 rounded-full shadow-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create hosted zone"}
          </button>
        </div>
      </form>
    </div>
  )
}
