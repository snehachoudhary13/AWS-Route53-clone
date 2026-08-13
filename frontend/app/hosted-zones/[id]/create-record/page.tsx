"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import {
  ChevronRight,
  Info,
  Columns,
} from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const RECORD_TYPES = ["A", "AAAA", "CNAME", "TXT", "MX", "NS", "PTR", "SRV", "CAA"] as const
type RecordType = (typeof RECORD_TYPES)[number]

const TYPE_DESCRIPTIONS: Record<RecordType, string> = {
  A: "A – Routes traffic to an IPv4 address and some AWS resources",
  AAAA: "AAAA – Routes traffic to an IPv6 address and some AWS resources",
  CNAME: "CNAME – Routes traffic to another domain name and some AWS resources",
  TXT: "TXT – Used to verify domain ownership and for SPF/DKIM verification",
  MX: "MX – Routes mail to mail servers",
  NS: "NS – Delegates a subdomain to other name servers",
  PTR: "PTR – Maps an IP address to a domain name",
  SRV: "SRV – Used for service discovery and locators",
  CAA: "CAA – Restricts which certificate authorities can issue certificates",
}

const VALUE_PLACEHOLDERS: Record<RecordType, string> = {
  A: "192.0.2.235",
  AAAA: "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
  CNAME: "target.example.com",
  TXT: '"v=spf1 include:example.com ~all"',
  MX: "mail.example.com",
  NS: "ns1.example.com",
  PTR: "hostname.example.com",
  SRV: "sip.example.com",
  CAA: '0 issue "letsencrypt.org"',
}

interface HostedZone {
  id: number
  name: string
  type: string
  comment: string | null
  created_at: string
  record_count: number
}

interface DNSRecord {
  id: number
  zone_id: number
  name: string
  type: string
  value: string
  ttl: number
  priority: number | null
  weight: number | null
  port: number | null
  created_at: string
  updated_at: string
}

interface MultiRecordDraft {
  id: string
  name: string
  type: RecordType
  value: string
  ttl: number
  priority: number | ""
  weight: number | ""
  port: number | ""
  isAlias: boolean
  collapsed: boolean
  error?: string
}

export default function CreateRecordPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const zoneId = params.id as string

  const [zone, setZone] = useState<HostedZone | null>(null)
  const [existingRecords, setExistingRecords] = useState<DNSRecord[]>([])
  const [showExistingRecords, setShowExistingRecords] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const [draftRecords, setDraftRecords] = useState<MultiRecordDraft[]>([
    {
      id: "rec-1",
      name: "",
      type: "A",
      value: "",
      ttl: 300,
      priority: "",
      weight: "",
      port: "",
      isAlias: false,
      collapsed: false,
    },
  ])

  const fetchZoneData = useCallback(async () => {
    try {
      const [z, recs] = await Promise.all([
        apiFetch<HostedZone>(`/hosted-zones/${zoneId}`),
        apiFetch<{ records: DNSRecord[]; total: number }>(`/hosted-zones/${zoneId}/records?limit=100`),
      ])
      setZone(z)
      setExistingRecords(recs.records)
    } catch {
      toast({
        title: "Failed to load zone",
        description: "Could not retrieve zone info.",
        variant: "destructive",
      })
    }
  }, [zoneId, toast])

  useEffect(() => {
    fetchZoneData()
  }, [fetchZoneData])

  const addAnotherRecord = () => {
    const nextIdx = draftRecords.length + 1
    setDraftRecords((prev) => [
      ...prev,
      {
        id: `rec-${Date.now()}-${nextIdx}`,
        name: "",
        type: "A",
        value: "",
        ttl: 300,
        priority: "",
        weight: "",
        port: "",
        isAlias: false,
        collapsed: false,
      },
    ])
  }

  const removeDraftRecord = (id: string) => {
    if (draftRecords.length <= 1) return
    setDraftRecords((prev) => prev.filter((r) => r.id !== id))
  }

  const updateDraft = (id: string, updates: Partial<MultiRecordDraft>) => {
    setDraftRecords((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates, error: undefined } : r))
    )
  }

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!zone) return

    let hasError = false
    const validated = draftRecords.map((draft) => {
      if (!draft.value.trim()) {
        hasError = true
        return { ...draft, error: "Value is required." }
      }
      return draft
    })

    if (hasError) {
      setDraftRecords(validated)
      return
    }

    setActionLoading(true)
    let createdCount = 0

    try {
      for (const draft of draftRecords) {
        let fqdn = draft.name.trim()
        if (!fqdn || fqdn === "@") {
          fqdn = zone.name
        } else if (!fqdn.endsWith(".")) {
          fqdn = fqdn.endsWith(zone.name) ? `${fqdn}.` : `${fqdn}.${zone.name}`
        }

        await apiFetch(`/hosted-zones/${zoneId}/records`, {
          method: "POST",
          body: JSON.stringify({
            name: fqdn,
            type: draft.type,
            value: draft.value.trim(),
            ttl: Number(draft.ttl) || 300,
            priority: draft.priority !== "" ? Number(draft.priority) : null,
            weight: draft.weight !== "" ? Number(draft.weight) : null,
            port: draft.port !== "" ? Number(draft.port) : null,
          }),
        })
        createdCount++
      }

      toast({
        title: createdCount === 1 ? "Record created" : `${createdCount} records created`,
        description: `Successfully created ${createdCount} record(s) in ${zone.name}`,
        variant: "success",
      })

      router.push(`/hosted-zones/${zoneId}`)
    } catch (err: unknown) {
      toast({
        title: "Failed to create records",
        description: err instanceof Error ? err.message : "Error creating record",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const domainClean = zone?.name ? zone.name.replace(/\.$/, "") : "example.com"

  return (
    <div className="space-y-4 max-w-7xl font-sans pb-16">
      {/* Custom AWS Breadcrumb row matching real Route53 */}
      <div className="flex items-center justify-between text-xs pb-1">
        <div className="flex items-center space-x-1.5 text-[#5f6b7a] dark:text-gray-400">
          <Link href="/dashboard" className="text-[#0972d3] dark:text-[#42a5f5] hover:underline font-medium">
            Route 53
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          <Link href="/hosted-zones" className="text-[#0972d3] dark:text-[#42a5f5] hover:underline font-medium">
            Hosted zones
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          <Link
            href={`/hosted-zones/${zoneId}`}
            className="text-[#0972d3] dark:text-[#42a5f5] hover:underline font-medium"
          >
            {domainClean}
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[#16191f] dark:text-gray-200">Create record</span>
        </div>
        <div className="flex items-center gap-3 text-gray-500">
          <Columns className="w-4 h-4 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
          <Info className="w-4 h-4 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300" />
        </div>
      </div>

      {/* Heading */}
      <div className="flex items-center gap-2 pt-1">
        <h1 className="text-2xl font-bold text-[#16191f] dark:text-gray-100">
          Create record
        </h1>
        <span className="text-[#0972d3] dark:text-[#42a5f5] text-xs font-medium cursor-pointer hover:underline">
          Info
        </span>
      </div>

      {/* Main Quick create record Card (Single unified card with NO outer sub-box) */}
      <div className="border border-[#d5dbdb] dark:border-[#2a3747] rounded-lg bg-white dark:bg-[#16212e] shadow-sm transition-colors overflow-hidden">
        {/* Card Top Title Row */}
        <div className="px-6 py-4 border-b border-[#eaeded] dark:border-[#2a3747] flex items-center justify-between">
          <h2 className="text-base font-bold text-[#16191f] dark:text-gray-100">
            Quick create record
          </h2>
          <span className="text-xs text-[#0972d3] dark:text-[#42a5f5] font-medium hover:underline cursor-pointer">
            Switch to wizard
          </span>
        </div>

        <form onSubmit={handleCreateSubmit} className="p-6 space-y-6">
          {draftRecords.map((draft, idx) => {
            const needsPriority = draft.type === "MX" || draft.type === "SRV"
            const needsSRV = draft.type === "SRV"

            return (
              <div key={draft.id} className="space-y-5">
                {/* Record Accordion Header */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-800 dark:text-gray-200 select-none">▼</span>
                    <span className="font-bold text-sm text-[#16191f] dark:text-gray-100">
                      Record {idx + 1}
                    </span>
                  </div>
                  {draftRecords.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDraftRecord(draft.id)}
                      className="text-xs border border-gray-400 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-1 rounded-full transition-colors font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>

                {/* Row 1: Record Name & Record Type */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Record name */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#16191f] dark:text-gray-100">
                        Record name
                      </Label>
                      <span className="text-[11px] text-[#0972d3] dark:text-[#42a5f5] hover:underline cursor-pointer">
                        Info
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Input
                        value={draft.name}
                        onChange={(e) => updateDraft(draft.id, { name: e.target.value })}
                        placeholder="subdomain"
                        className="h-9 text-xs border border-[#7d8998] dark:border-gray-700 bg-white dark:bg-[#121c27] focus-visible:ring-1 focus-visible:ring-[#0972d3] focus-visible:border-[#0972d3] rounded-sm font-sans flex-1"
                      />
                      <span className="text-xs text-[#16191f] dark:text-gray-300 font-medium shrink-0">
                        {domainClean}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400">
                      Keep blank to create a record for the root domain.
                    </p>
                  </div>

                  {/* Record type */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#16191f] dark:text-gray-100">
                        Record type
                      </Label>
                      <span className="text-[11px] text-[#0972d3] dark:text-[#42a5f5] hover:underline cursor-pointer">
                        Info
                      </span>
                    </div>
                    <Select
                      value={draft.type}
                      onValueChange={(val) => updateDraft(draft.id, { type: val as RecordType })}
                    >
                      <SelectTrigger className="h-9 text-xs border border-[#7d8998] dark:border-gray-700 bg-white dark:bg-[#121c27] focus:ring-1 focus:ring-[#0972d3] rounded-sm font-sans">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                        {RECORD_TYPES.map((t) => (
                          <SelectItem key={t} value={t} className="text-xs">
                            {TYPE_DESCRIPTIONS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Alias Toggle Switch (Real AWS style pill switch) */}
                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={draft.isAlias}
                    onClick={() => updateDraft(draft.id, { isAlias: !draft.isAlias })}
                    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      draft.isAlias ? "bg-[#0972d3]" : "bg-[#545b64] dark:bg-gray-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        draft.isAlias ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <Label
                    onClick={() => updateDraft(draft.id, { isAlias: !draft.isAlias })}
                    className="text-xs font-bold text-[#16191f] dark:text-gray-100 cursor-pointer"
                  >
                    Alias
                  </Label>
                </div>

                {/* Value Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs font-bold text-[#16191f] dark:text-gray-100">
                      Value
                    </Label>
                    <span className="text-[11px] text-[#0972d3] dark:text-[#42a5f5] hover:underline cursor-pointer">
                      Info
                    </span>
                  </div>
                  <Textarea
                    value={draft.value}
                    onChange={(e) => updateDraft(draft.id, { value: e.target.value })}
                    placeholder={VALUE_PLACEHOLDERS[draft.type]}
                    rows={4}
                    className={`text-xs font-mono border border-[#7d8998] dark:border-gray-700 bg-white dark:bg-[#121c27] focus-visible:ring-1 focus-visible:ring-[#0972d3] focus-visible:border-[#0972d3] rounded-sm resize-y ${
                      draft.error ? "border-red-500" : ""
                    }`}
                  />
                  {draft.error && (
                    <p className="text-xs text-red-600 dark:text-red-400">{draft.error}</p>
                  )}
                  <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400">
                    Enter multiple values on separate lines.
                  </p>
                </div>

                {/* Optional MX/SRV priority/weight/port fields */}
                {needsPriority && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-3 bg-gray-50 dark:bg-[#121c27] rounded-sm border border-gray-200 dark:border-gray-800">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold">Priority</Label>
                      <Input
                        type="number"
                        min={0}
                        max={65535}
                        value={draft.priority}
                        onChange={(e) =>
                          updateDraft(draft.id, {
                            priority: e.target.value === "" ? "" : Number(e.target.value),
                          })
                        }
                        placeholder="10"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    {needsSRV && (
                      <>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Weight</Label>
                          <Input
                            type="number"
                            min={0}
                            max={65535}
                            value={draft.weight}
                            onChange={(e) =>
                              updateDraft(draft.id, {
                                weight: e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                            placeholder="5"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-bold">Port</Label>
                          <Input
                            type="number"
                            min={1}
                            max={65535}
                            value={draft.port}
                            onChange={(e) =>
                              updateDraft(draft.id, {
                                port: e.target.value === "" ? "" : Number(e.target.value),
                              })
                            }
                            placeholder="443"
                            className="h-8 text-xs font-mono"
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* TTL & Routing Policy Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-1">
                  {/* TTL */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#16191f] dark:text-gray-100">
                        TTL (seconds)
                      </Label>
                      <span className="text-[11px] text-[#0972d3] dark:text-[#42a5f5] hover:underline cursor-pointer">
                        Info
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={draft.ttl}
                        onChange={(e) => updateDraft(draft.id, { ttl: Number(e.target.value) })}
                        className="h-8 text-xs font-sans max-w-[240px] border border-[#7d8998] dark:border-gray-700 bg-white dark:bg-[#121c27] rounded-sm"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateDraft(draft.id, { ttl: 60 })}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                            draft.ttl === 60
                              ? "border-[#0972d3] text-[#0972d3] bg-[#f1f8fa] dark:bg-[#192635] font-bold"
                              : "border-[#0972d3] text-[#0972d3] hover:bg-[#f1f8fa] dark:hover:bg-[#192635] font-medium"
                          }`}
                        >
                          1m
                        </button>
                        <button
                          type="button"
                          onClick={() => updateDraft(draft.id, { ttl: 3600 })}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                            draft.ttl === 3600
                              ? "border-[#0972d3] text-[#0972d3] bg-[#f1f8fa] dark:bg-[#192635] font-bold"
                              : "border-[#0972d3] text-[#0972d3] hover:bg-[#f1f8fa] dark:hover:bg-[#192635] font-medium"
                          }`}
                        >
                          1h
                        </button>
                        <button
                          type="button"
                          onClick={() => updateDraft(draft.id, { ttl: 86400 })}
                          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                            draft.ttl === 86400
                              ? "border-[#0972d3] text-[#0972d3] bg-[#f1f8fa] dark:bg-[#192635] font-bold"
                              : "border-[#0972d3] text-[#0972d3] hover:bg-[#f1f8fa] dark:hover:bg-[#192635] font-medium"
                          }`}
                        >
                          1d
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400">
                      Recommended values: 60 to 172800 (two days)
                    </p>
                  </div>

                  {/* Routing policy */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs font-bold text-[#16191f] dark:text-gray-100">
                        Routing policy
                      </Label>
                      <span className="text-[11px] text-[#0972d3] dark:text-[#42a5f5] hover:underline cursor-pointer">
                        Info
                      </span>
                    </div>
                    <Select defaultValue="simple">
                      <SelectTrigger className="h-8 text-xs border border-[#7d8998] dark:border-gray-700 bg-white dark:bg-[#121c27] rounded-sm">
                        <SelectValue placeholder="Simple routing" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                        <SelectItem value="simple" className="text-xs">
                          Simple routing
                        </SelectItem>
                        <SelectItem value="weighted" className="text-xs">
                          Weighted routing
                        </SelectItem>
                        <SelectItem value="geolocation" className="text-xs">
                          Geolocation routing
                        </SelectItem>
                        <SelectItem value="latency" className="text-xs">
                          Latency routing
                        </SelectItem>
                        <SelectItem value="failover" className="text-xs">
                          Failover routing
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )
          })}

          {/* Add another record button at bottom of card */}
          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={addAnotherRecord}
              className="border border-[#0972d3] text-[#0972d3] dark:text-[#42a5f5] dark:border-[#42a5f5] hover:bg-[#f1f8fa] dark:hover:bg-[#192635] font-bold text-xs py-1.5 px-6 rounded-full transition-colors"
            >
              Add another record
            </button>
          </div>
        </form>
      </div>

      {/* Page Footer Action Buttons (Cancel / Create records) */}
      <div className="flex items-center justify-end gap-5 pt-2">
        <button
          type="button"
          onClick={() => router.push(`/hosted-zones/${zoneId}`)}
          className="text-xs font-bold text-[#0972d3] dark:text-[#42a5f5] hover:underline"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreateSubmit}
          disabled={actionLoading}
          className="bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white font-bold text-xs py-2 px-6 rounded-full shadow-sm transition-colors disabled:opacity-50"
        >
          {actionLoading ? "Creating…" : "Create records"}
        </button>
      </div>

      {/* Collapsible: View existing records table preview */}
      <div className="border border-[#d5dbdb] dark:border-[#2a3747] rounded-sm bg-white dark:bg-[#16212e] shadow-sm transition-colors mt-6">
        <button
          type="button"
          onClick={() => setShowExistingRecords(!showExistingRecords)}
          className="w-full px-5 py-3 flex items-center gap-2 text-xs font-bold text-[#16191f] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#121c27] text-left select-none"
        >
          <span className="text-[10px] text-gray-700 dark:text-gray-300">
            {showExistingRecords ? "▼" : "▶"}
          </span>
          <span>View existing records</span>
        </button>

        {showExistingRecords && (
          <div className="px-5 pb-5 pt-1 border-t border-[#eaeded] dark:border-[#2a3747] space-y-3">
            <p className="text-xs text-[#5f6b7a] dark:text-gray-400">
              The following table lists the existing records in <strong>{domainClean}</strong>.
            </p>
            <div className="border border-[#eaeded] dark:border-[#2a3747] rounded-sm overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#f2f3f3] dark:bg-[#121c27] text-xs font-bold">
                    <TableHead className="px-3 py-2">Record name</TableHead>
                    <TableHead className="px-3 py-2">Type</TableHead>
                    <TableHead className="px-3 py-2">Routing</TableHead>
                    <TableHead className="px-3 py-2">Value / Route traffic to</TableHead>
                    <TableHead className="px-3 py-2">TTL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {existingRecords.map((r) => (
                    <TableRow key={r.id} className="text-xs">
                      <TableCell className="px-3 py-2 font-mono">{r.name}</TableCell>
                      <TableCell className="px-3 py-2 font-bold">{r.type}</TableCell>
                      <TableCell className="px-3 py-2 text-gray-500">Simple</TableCell>
                      <TableCell className="px-3 py-2 font-mono">{r.value}</TableCell>
                      <TableCell className="px-3 py-2 font-mono">{r.ttl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
