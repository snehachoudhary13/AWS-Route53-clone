"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { parseBindZone, ParsedRecord } from "@/lib/bind-parser"
import { exportZoneAsJSON } from "@/lib/export"
import { BulkActionBar } from "@/components/BulkActionBar"
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Trash2,
  Columns,
  CheckCircle2,
  X,
  Copy,
  Check,
  Settings,
} from "lucide-react"

// shadcn components
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Constants ──────────────────────────────────────────────────────────────────

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

const PAGE_SIZE = 25

// ─── Types ──────────────────────────────────────────────────────────────────────

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

type DialogMode = "delete" | "import" | "export" | "edit" | null

export default function HostedZoneDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const zoneId = params.id as string
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Route Params / Created Banner ─────────────────────────────────────────
  const isCreatedParam = searchParams.get("created") === "true"
  const createdNameParam = searchParams.get("name")
  const [showCreatedBanner, setShowCreatedBanner] = useState(isCreatedParam)

  useEffect(() => {
    if (isCreatedParam) {
      setShowCreatedBanner(true)
    }
  }, [isCreatedParam])

  // ── View Mode: "list" | "create" ──────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"list" | "create">("list")

  // ── Data ──────────────────────────────────────────────────────────────────
  const [zone, setZone] = useState<HostedZone | null>(null)
  const [records, setRecords] = useState<DNSRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // ── Zone Details & Table Accordions ───────────────────────────────────────
  const [showZoneDetails, setShowZoneDetails] = useState(false)
  const [showExistingRecords, setShowExistingRecords] = useState(false)
  const [activeTab, setActiveTab] = useState<"records" | "recovery" | "dnssec" | "tags">("records")

  // ── Filters / pagination ──────────────────────────────────────────────────
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [page, setPage] = useState(1)

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Dialog & Notifications ────────────────────────────────────────────────
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [successBannerMessage, setSuccessBannerMessage] = useState<string | null>(null)
  const [deleteZoneModalOpen, setDeleteZoneModalOpen] = useState(false)

  // ── Single Edit State ─────────────────────────────────────────────────────
  const [editRecord, setEditRecord] = useState<DNSRecord | null>(null)
  const [editName, setEditName] = useState("")
  const [editType, setEditType] = useState<RecordType>("A")
  const [editValue, setEditValue] = useState("")
  const [editTtl, setEditTtl] = useState(300)
  const [editPriority, setEditPriority] = useState<number | "">("")
  const [editWeight, setEditWeight] = useState<number | "">("")
  const [editPort, setEditPort] = useState<number | "">("")
  const [editError, setEditError] = useState("")

  // ── Multi-Record Drafts for "Quick Create Record" ─────────────────────────
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

  // ── Import BIND State ─────────────────────────────────────────────────────
  const [bindContent, setBindContent] = useState("")
  const [parsedBindRecords, setParsedBindRecords] = useState<ParsedRecord[]>([])

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [zoneData, recData] = await Promise.all([
        apiFetch<HostedZone>(`/hosted-zones/${zoneId}`),
        apiFetch<{ records: DNSRecord[]; total: number }>(
          `/hosted-zones/${zoneId}/records?${new URLSearchParams({
            ...(search ? { search } : {}),
            ...(typeFilter !== "all" ? { type: typeFilter } : {}),
            page: String(page),
            limit: String(PAGE_SIZE),
          })}`
        ),
      ])
      setZone(zoneData)
      setRecords(recData.records)
      setTotal(recData.total)
    } catch {
      toast({
        title: "Failed to load records",
        description: "Could not retrieve zone details from backend.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [zoneId, search, typeFilter, page, toast])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // ── Multi-Record Actions ──────────────────────────────────────────────────
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

    // Validation
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

      // Reset create view & reload
      setDraftRecords([
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
      setViewMode("list")
      fetchAll()
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

  // ── Single Edit Record ────────────────────────────────────────────────────
  const openEdit = (record: DNSRecord) => {
    setEditRecord(record)
    const suffix = `.${zone?.name}`
    const prefix = record.name.endsWith(suffix)
      ? record.name.slice(0, -suffix.length)
      : record.name.replace(/\.$/, "")
    setEditName(prefix === zone?.name.replace(/\.$/, "") ? "" : prefix)
    setEditType(record.type as RecordType)
    setEditValue(record.value)
    setEditTtl(record.ttl)
    setEditPriority(record.priority ?? "")
    setEditWeight(record.weight ?? "")
    setEditPort(record.port ?? "")
    setEditError("")
    setDialogMode("edit")
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRecord || !zone) return

    if (!editValue.trim()) {
      setEditError("Value is required.")
      return
    }

    setActionLoading(true)
    try {
      let fqdn = editName.trim()
      if (!fqdn || fqdn === "@") {
        fqdn = zone.name
      } else if (!fqdn.endsWith(".")) {
        fqdn = fqdn.endsWith(zone.name) ? `${fqdn}.` : `${fqdn}.${zone.name}`
      }

      await apiFetch(`/hosted-zones/${zoneId}/records/${editRecord.id}`, {
        method: "PUT",
        body: JSON.stringify({
          name: fqdn,
          type: editType,
          value: editValue.trim(),
          ttl: Number(editTtl) || 300,
          priority: editPriority !== "" ? Number(editPriority) : null,
          weight: editWeight !== "" ? Number(editWeight) : null,
          port: editPort !== "" ? Number(editPort) : null,
        }),
      })

      toast({
        title: "Record updated",
        description: `Updated record ${fqdn}`,
        variant: "success",
      })
      setDialogMode(null)
      fetchAll()
    } catch (err: unknown) {
      toast({
        title: "Failed to update record",
        description: err instanceof Error ? err.message : "Update failed",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Delete Records ────────────────────────────────────────────────────────
  const handleDeleteRecords = async () => {
    setActionLoading(true)
    try {
      const count = selectedIds.size
      for (const id of Array.from(selectedIds)) {
        await apiFetch(`/hosted-zones/${zoneId}/records/${id}`, { method: "DELETE" })
      }
      setSuccessBannerMessage(
        `${count} DNS record${count > 1 ? "s were" : " was"} successfully deleted.`
      )
      setSelectedIds(new Set())
      setDialogMode(null)
      fetchAll()
    } catch (err: unknown) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Error deleting record",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Delete Entire Hosted Zone ─────────────────────────────────────────────
  const handleDeleteZone = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== "delete") return
    setActionLoading(true)
    try {
      await apiFetch(`/hosted-zones/${zoneId}`, { method: "DELETE" })
      toast({
        title: "Hosted zone deleted",
        description: `Hosted zone ${domainClean} was successfully deleted.`,
        variant: "success",
      })
      router.push("/hosted-zones")
    } catch (err: unknown) {
      toast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Error deleting zone",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Selection helpers ─────────────────────────────────────────────────────
  const allSelected = records.length > 0 && records.every((r) => selectedIds.has(r.id))
  const someSelected = records.some((r) => selectedIds.has(r.id)) && !allSelected
  const toggleRow = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(records.map((r) => r.id)))
  }
  const singleSelectedRecord = selectedIds.size === 1 ? records.find((r) => selectedIds.has(r.id)) ?? null : null

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: "/",
      description: "Focus search bar",
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: "n",
      description: "Create DNS record",
      action: () => router.push(`/hosted-zones/${zoneId}/create-record`),
    },
    {
      key: "r",
      description: "Refresh records",
      action: () => fetchAll(),
    },
    {
      key: "a",
      description: "Select / Deselect all",
      action: () => toggleAll(),
    },
    {
      key: "Escape",
      description: "Cancel create or clear selection",
      action: () => {
        if (viewMode === "create") setViewMode("list")
        else if (dialogMode) setDialogMode(null)
        else setSelectedIds(new Set())
      },
    },
  ])

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  // Clean domain display name (strip trailing dot for UI)
  const domainClean = zone?.name ? zone.name.replace(/\.$/, "") : "example.com"

  // ==========================================================================
  // VIEW 1: QUICK CREATE RECORD VIEW (Pixel-accurate match to Image 1)
  // ==========================================================================
  if (viewMode === "create") {
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
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="text-[#0972d3] dark:text-[#42a5f5] hover:underline font-medium"
            >
              {domainClean}
            </button>
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
            onClick={() => setViewMode("list")}
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
                    {records.map((r) => (
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

  // ==========================================================================
  // VIEW 2: HOSTED ZONE DETAILS & RECORDS TABLE (Matching Screenshot 3)
  // ==========================================================================
  return (
    <div className="space-y-4 max-w-7xl font-sans pb-16">
      {/* AWS Green Creation Banner (Exact match to screenshot) */}
      {showCreatedBanner && (
        <div className="bg-[#037f0c] text-white px-4 py-3 rounded-sm flex items-start justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-white shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <div className="font-bold">{createdNameParam || domainClean} was successfully created.</div>
              <div className="text-gray-100 text-[11.5px] font-normal">
                Now you can create records in the hosted zone to specify how you want Route 53 to route traffic for your domain.
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreatedBanner(false)}
            className="text-white hover:text-gray-200 p-1"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* AWS Green Action Success Alert Banner */}
      {successBannerMessage && (
        <div className="bg-[#037f0c] text-white px-4 py-3 rounded-sm flex items-center justify-between shadow-sm animate-in fade-in duration-150">
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
            <span>{successBannerMessage}</span>
          </div>
          <button
            onClick={() => setSuccessBannerMessage(null)}
            className="text-white hover:text-gray-200 p-1"
            aria-label="Close notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Zone Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Badge
            variant={zone?.type === "Public" ? "public" : "private"}
            className="rounded-full text-xs font-semibold px-3 py-0.5"
          >
            {zone?.type || "Public"}
          </Badge>
          <h1 className="text-2xl font-bold text-[#16191f] dark:text-gray-100">
            {domainClean}
          </h1>
          <span className="text-[#0972d3] dark:text-[#42a5f5] text-xs font-medium cursor-pointer hover:underline">
            Info
          </span>
        </div>

        {/* Top Right Action Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="aws-outline"
            size="sm"
            onClick={() => {
              setDeleteConfirmText("")
              setDeleteZoneModalOpen(true)
            }}
            className="h-8 text-xs rounded-full dark:border-gray-700"
          >
            Delete zone
          </Button>
          <Button
            variant="aws-outline"
            size="sm"
            onClick={() =>
              toast({
                title: "Test DNS record",
                description: "Simulated DNS resolver test response returned status NOERROR (0).",
              })
            }
            className="h-8 text-xs rounded-full dark:border-gray-700"
          >
            Test record
          </Button>
          <Button
            variant="aws-outline"
            size="sm"
            onClick={() =>
              toast({
                title: "Query logging",
                description: "Query logging configuration is simulated in this clone.",
              })
            }
            className="h-8 text-xs rounded-full dark:border-gray-700"
          >
            Configure query logging
          </Button>
          <Button
            variant="aws-outline"
            size="sm"
            onClick={() => router.push("/hosted-zones")}
            className="h-8 text-xs rounded-full dark:border-gray-700"
          >
            Edit hosted zone
          </Button>
        </div>
      </div>

      {/* Expandable: Hosted zone details */}
      <div className="border border-[#d5dbdb] dark:border-[#2a3747] rounded-sm bg-white dark:bg-[#16212e] shadow-sm transition-colors">
        <button
          type="button"
          onClick={() => setShowZoneDetails(!showZoneDetails)}
          className="w-full px-4 py-2.5 flex items-center gap-2 text-xs font-bold text-[#16191f] dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#121c27] text-left select-none"
        >
          <span className="text-[10px] text-gray-700 dark:text-gray-300">
            {showZoneDetails ? "▼" : "▶"}
          </span>
          <span>Hosted zone details</span>
        </button>

        {showZoneDetails && zone && (
          <div className="px-4 pb-4 pt-2 border-t border-[#eaeded] dark:border-[#2a3747] grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Hosted zone ID</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">
                Z{String(zone.id).padStart(4, "0")}{zone.id * 9382103}
              </span>
            </div>
            <div>
              <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Domain name</span>
              <span className="font-mono text-gray-900 dark:text-gray-100">{domainClean}</span>
            </div>
            <div>
              <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Type</span>
              <span>{zone.type} hosted zone</span>
            </div>
            <div>
              <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Record count</span>
              <span>{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-[#eaeded] dark:border-[#2a3747] flex items-center gap-6 text-xs font-bold">
        <button
          onClick={() => setActiveTab("records")}
          className={`py-2.5 border-b-2 transition-colors ${
            activeTab === "records"
              ? "border-[#0972d3] text-[#0972d3] dark:text-[#42a5f5]"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          Records ({total})
        </button>
        <button
          onClick={() => setActiveTab("recovery")}
          className={`py-2.5 border-b-2 transition-colors ${
            activeTab === "recovery"
              ? "border-[#0972d3] text-[#0972d3] dark:text-[#42a5f5]"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          Accelerated recovery
        </button>
        <button
          onClick={() => setActiveTab("dnssec")}
          className={`py-2.5 border-b-2 transition-colors ${
            activeTab === "dnssec"
              ? "border-[#0972d3] text-[#0972d3] dark:text-[#42a5f5]"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          DNSSEC signing
        </button>
        <button
          onClick={() => setActiveTab("tags")}
          className={`py-2.5 border-b-2 transition-colors ${
            activeTab === "tags"
              ? "border-[#0972d3] text-[#0972d3] dark:text-[#42a5f5]"
              : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900"
          }`}
        >
          Hosted zone tags (0)
        </button>
      </div>

      {/* Records Table Card */}
      <div className="border border-[#d5dbdb] dark:border-[#2a3747] rounded-sm bg-white dark:bg-[#16212e] shadow-sm transition-colors">
        {/* Table Toolbar (Exact AWS Route 53 Replica) */}
        <div className="p-4 border-b border-[#eaeded] dark:border-[#2a3747] space-y-3 bg-white dark:bg-[#16212e]">
          {/* Top Row: Title + Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[#16191f] dark:text-gray-100">
                  Records <span className="font-bold">({total})</span>
                </h2>
                <span className="text-[#0972d3] dark:text-[#42a5f5] text-xs font-medium cursor-pointer hover:underline">
                  Info
                </span>
              </div>
              <p className="text-xs text-[#5f6b7a] dark:text-gray-400 mt-0.5">
                Automatic mode is the current search behavior optimized for best filter results.{" "}
                <span className="text-[#0972d3] dark:text-[#42a5f5] cursor-pointer hover:underline">
                  To change modes go to settings.
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <button
                onClick={fetchAll}
                className="h-8 w-8 rounded-full border border-[#0972d3] text-[#0972d3] hover:bg-[#f1f8fa] dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
                title="Refresh (r)"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>

              <button
                disabled={selectedIds.size === 0}
                onClick={() => setDialogMode("delete")}
                className="h-8 px-4 text-xs rounded-full border border-gray-300 dark:border-gray-700 text-gray-500 font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:border-gray-400 dark:hover:border-gray-600 transition-colors"
              >
                Delete record
              </button>

              <button
                onClick={() => setDialogMode("import")}
                className="h-8 px-4 text-xs rounded-full border border-[#0972d3] text-[#0972d3] hover:bg-[#f1f8fa] dark:hover:bg-gray-800 font-bold transition-colors"
              >
                Import zone file
              </button>

              <button
                onClick={() => router.push(`/hosted-zones/${zoneId}/create-record`)}
                className="h-8 px-5 text-xs rounded-full bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white font-bold shadow-sm transition-colors"
              >
                Create record
              </button>
            </div>
          </div>

          {/* Bottom Row: Search + Filter Pills + Pagination + Gear */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#5f6b7a] dark:text-gray-400" />
              <Input
                ref={searchInputRef}
                id="records-search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Filter records by property or value"
                className="pl-9 h-8 text-xs border border-[#aab7b8] dark:border-gray-700 bg-white dark:bg-[#121c27] text-gray-900 dark:text-gray-100 rounded-sm focus-visible:ring-1 focus-visible:ring-[#0972d3]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Type Filter */}
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="h-8 px-3 text-xs border border-[#aab7b8] dark:border-gray-700 bg-white dark:bg-[#121c27] rounded-sm font-medium">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                  <SelectItem value="all" className="text-xs">All Types</SelectItem>
                  {RECORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Routing Policy Filter */}
              <Select defaultValue="all">
                <SelectTrigger className="h-8 px-3 text-xs border border-[#aab7b8] dark:border-gray-700 bg-white dark:bg-[#121c27] rounded-sm font-medium">
                  <SelectValue placeholder="Routing p..." />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                  <SelectItem value="all" className="text-xs">All policies</SelectItem>
                  <SelectItem value="simple" className="text-xs">Simple</SelectItem>
                  <SelectItem value="weighted" className="text-xs">Weighted</SelectItem>
                </SelectContent>
              </Select>

              {/* Alias Filter */}
              <Select defaultValue="all">
                <SelectTrigger className="h-8 px-3 text-xs border border-[#aab7b8] dark:border-gray-700 bg-white dark:bg-[#121c27] rounded-sm font-medium">
                  <SelectValue placeholder="Alias" />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                  <SelectItem value="all" className="text-xs">All</SelectItem>
                  <SelectItem value="yes" className="text-xs">Yes</SelectItem>
                  <SelectItem value="no" className="text-xs">No</SelectItem>
                </SelectContent>
              </Select>

              {/* Compact pagination & gear */}
              <div className="flex items-center gap-1 border-l border-gray-300 dark:border-gray-700 pl-2 text-xs text-[#5f6b7a] dark:text-gray-400">
                <button
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  className="p-1 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="font-mono px-1 font-semibold text-[#16191f] dark:text-gray-100">{page}</span>
                <button
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  className="p-1 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button className="p-1 hover:text-gray-900 dark:hover:text-gray-100 ml-1" title="Preferences">
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table & Record Details Split Panel */}
        <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-[#eaeded] dark:divide-[#2a3747] overflow-x-auto">
          <div className="flex-1 min-w-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#f2f3f3] dark:bg-[#121c27] border-b border-[#eaeded] dark:border-[#2a3747]">
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={allSelected}
                      data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                      onCheckedChange={toggleAll}
                      aria-label="Select all records"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    Record ... ▼
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    Type ▼
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    Routin... ▼
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    Differ... ▲
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    Alias ▼
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3">
                    Value/Route traffic to
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    TTL (s... ▼
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3 whitespace-nowrap">
                    Health ... ▼
                  </TableHead>
                  <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 px-3 whitespace-nowrap">
                    Evalua... ▼
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={`skel-${i}`} className="border-b border-[#eaeded] dark:border-[#2a3747]">
                      <TableCell className="px-3 py-3"><div className="h-4 w-4 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-32" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-4 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-8" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-12" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-4" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-6" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-48" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-10" /></TableCell>
                      <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-4" /></TableCell>
                      <TableCell className="px-3 py-3"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-4" /></TableCell>
                    </TableRow>
                  ))
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-14 text-center">
                      <div className="max-w-md mx-auto space-y-3">
                        <p className="text-base font-bold text-[#16191f] dark:text-gray-100">
                          {search || typeFilter !== "all" ? "No matching records" : "No DNS records"}
                        </p>
                        <p className="text-xs text-[#5f6b7a] dark:text-gray-400">
                          {search || typeFilter !== "all"
                            ? "Try adjusting your search criteria."
                            : "Create a record or import a zone file to begin."}
                        </p>
                        {!search && typeFilter === "all" && (
                          <Button
                            variant="aws"
                            size="sm"
                            onClick={() => router.push(`/hosted-zones/${zoneId}/create-record`)}
                            className="rounded-full font-bold text-xs px-5 shadow-sm mt-2"
                          >
                            Create record
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r) => {
                    const selected = selectedIds.has(r.id)
                    return (
                      <TableRow
                        key={r.id}
                        data-state={selected ? "selected" : undefined}
                        className={`border-b border-[#eaeded] dark:border-[#2a3747] cursor-pointer transition-colors ${
                          selected
                            ? "bg-[#f0f4ff] dark:bg-[#1f2d3d]"
                            : "hover:bg-[#f8f9fa] dark:hover:bg-[#192635]"
                        }`}
                        onClick={() => toggleRow(r.id)}
                      >
                        <TableCell className="px-3 py-2.5">
                          <Checkbox
                            checked={selected}
                            onCheckedChange={() => toggleRow(r.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Select ${r.name}`}
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] font-mono text-xs text-[#16191f] dark:text-gray-200">
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(r)
                            }}
                            className="text-[#0972d3] dark:text-[#42a5f5] hover:underline cursor-pointer font-semibold"
                            title="Click to edit record"
                          >
                            {r.name}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs font-bold font-mono">
                          {r.type}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#5f6b7a] dark:text-gray-400">
                          Simple
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#5f6b7a] dark:text-gray-400">
                          -
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#5f6b7a] dark:text-gray-400">
                          No
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs font-mono text-[#16191f] dark:text-gray-200 max-w-sm">
                          <span className="break-all whitespace-pre-line">
                            {r.priority != null ? `${r.priority} ` : ""}
                            {r.value}
                            {r.weight != null ? ` (w:${r.weight})` : ""}
                            {r.port != null ? ` :${r.port}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs font-mono text-[#16191f] dark:text-gray-200">
                          {r.ttl.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#5f6b7a] dark:text-gray-400">
                          -
                        </TableCell>
                        <TableCell className="px-3 py-2.5 text-xs text-[#5f6b7a] dark:text-gray-400">
                          -
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Record Details Side Panel (Exact match to AWS Console Screenshot) */}
          {singleSelectedRecord ? (
            <div className="w-full lg:w-80 p-5 bg-[#fafafa] dark:bg-[#121c27] space-y-4 shrink-0 transition-all border-l border-[#eaeded] dark:border-[#2a3747]">
              <div className="flex items-center justify-between pb-2 border-b border-[#eaeded] dark:border-gray-800">
                <h3 className="text-sm font-bold text-[#16191f] dark:text-gray-100">Record details</h3>
                <div className="flex items-center gap-1 text-gray-500">
                  <Settings className="w-4 h-4 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200" />
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                    title="Close details panel"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <Button
                  variant="aws-outline"
                  size="sm"
                  onClick={() => openEdit(singleSelectedRecord)}
                  className="w-full text-xs rounded-full font-bold border-[#0972d3] text-[#0972d3] dark:text-[#42a5f5] hover:bg-[#f1f8fa]"
                >
                  Edit record
                </Button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Record name</span>
                  <div className="flex items-center justify-between font-mono pt-0.5">
                    <span className="text-gray-900 dark:text-gray-100 font-semibold">{singleSelectedRecord.name}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(singleSelectedRecord.name)
                        toast({ title: "Copied record name", variant: "success" })
                      }}
                      className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      title="Copy"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Record type</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100 font-mono block pt-0.5">{singleSelectedRecord.type}</span>
                </div>

                <div>
                  <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Value</span>
                  <div className="mt-1 p-2 bg-white dark:bg-[#16212e] border border-[#eaeded] dark:border-gray-800 rounded-sm font-mono text-[11px] space-y-1.5 max-h-48 overflow-y-auto">
                    {singleSelectedRecord.value.split("\n").map((valLine, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="break-all text-gray-800 dark:text-gray-200">{valLine}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(valLine)
                            toast({ title: "Copied value line", variant: "success" })
                          }}
                          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 shrink-0"
                          title="Copy"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Alias</span>
                  <span className="text-gray-900 dark:text-gray-100 block pt-0.5">No</span>
                </div>

                <div>
                  <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">TTL (seconds)</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100 block pt-0.5">{singleSelectedRecord.ttl.toLocaleString()}</span>
                </div>

                <div>
                  <span className="text-[#5f6b7a] dark:text-gray-400 block font-medium">Routing policy</span>
                  <span className="text-gray-900 dark:text-gray-100 block pt-0.5">Simple</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full lg:w-72 p-5 bg-[#fafafa] dark:bg-[#121c27] space-y-4 shrink-0 border-l border-[#eaeded] dark:border-[#2a3747] hidden md:block">
              <div className="flex items-center justify-between pb-2 border-b border-[#eaeded] dark:border-gray-800">
                <h3 className="text-sm font-bold text-[#16191f] dark:text-gray-100">0 records selected</h3>
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Settings className="w-4 h-4 cursor-pointer hover:text-gray-800 dark:hover:text-gray-200" />
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-[#5f6b7a] dark:text-gray-400">
                Select a record to see its details
              </p>
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        {total > PAGE_SIZE && (
          <div className="px-4 py-2.5 border-t border-[#eaeded] dark:border-[#2a3747] flex items-center justify-between bg-[#fafafa] dark:bg-[#121c27] text-xs text-[#5f6b7a] dark:text-gray-400">
            <span>
              Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
              {Math.min(page * PAGE_SIZE, total)} of {total} records
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!hasPrev}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium px-2">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!hasNext}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        itemLabel="DNS records"
        onClear={() => setSelectedIds(new Set())}
        onDelete={() => setDialogMode("delete")}
        onBulkUpdateTtl={async (newTtl) => {
          setActionLoading(true)
          try {
            for (const id of Array.from(selectedIds)) {
              await apiFetch(`/hosted-zones/${zoneId}/records/${id}`, {
                method: "PUT",
                body: JSON.stringify({ ttl: newTtl }),
              })
            }
            toast({
              title: "TTL Updated",
              description: `Updated TTL to ${newTtl}s for ${selectedIds.size} record(s).`,
              variant: "success",
            })
            setSelectedIds(new Set())
            fetchAll()
          } catch {
            toast({ title: "Bulk update failed", variant: "destructive" })
          } finally {
            setActionLoading(false)
          }
        }}
        onBulkExport={() => {
          const toExport = records.filter((r) => selectedIds.has(r.id))
          if (zone) exportZoneAsJSON(zone, toExport)
        }}
        loading={actionLoading}
      />

      {/* Edit Record Dialog */}
      <Dialog open={dialogMode === "edit"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#16212e] text-[#16191f] dark:text-gray-100 p-0 gap-0 border border-[#d5dbdb] dark:border-gray-700 shadow-xl">
          <DialogHeader className="px-6 py-4 border-b border-[#eaeded] dark:border-gray-800">
            <DialogTitle className="text-base font-bold">Edit record</DialogTitle>
            <DialogDescription className="text-xs text-[#5f6b7a] dark:text-gray-400">
              Update configuration for {editRecord?.name}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Record name</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-xs font-mono"
                  placeholder="subdomain"
                />
                <span className="text-xs font-mono text-gray-500">.{domainClean}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Record type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as RecordType)}>
                <SelectTrigger className="h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                  {RECORD_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Value / Route traffic to</Label>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                className="text-xs font-mono resize-none"
              />
              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">TTL (seconds)</Label>
                <Input
                  type="number"
                  min={1}
                  value={editTtl}
                  onChange={(e) => setEditTtl(Number(e.target.value))}
                  className="h-8 text-xs font-mono"
                />
              </div>

              {(editType === "MX" || editType === "SRV") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Priority</Label>
                  <Input
                    type="number"
                    value={editPriority}
                    onChange={(e) =>
                      setEditPriority(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t border-[#eaeded] dark:border-gray-800">
              <Button
                type="button"
                variant="link"
                className="text-[#0972d3] text-xs font-bold"
                onClick={() => setDialogMode(null)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="aws" size="sm" className="rounded-full font-bold text-xs">
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Record Confirmation Dialog */}
      <Dialog open={dialogMode === "delete"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-[480px] bg-white dark:bg-[#16212e] text-[#16191f] dark:text-gray-100 p-0 gap-0 border border-[#d5dbdb] dark:border-gray-700 shadow-xl rounded-lg overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-[#eaeded] dark:border-gray-800">
            <DialogTitle className="text-base font-bold">
              Delete {selectedIds.size} record{selectedIds.size > 1 ? "s" : ""}?
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-3">
            <p className="text-xs text-[#16191f] dark:text-gray-200 leading-relaxed">
              Delete the DNS record{selectedIds.size > 1 ? "s" : ""} permanently? This action cannot be undone.
            </p>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#eaeded] dark:border-gray-800 bg-[#fafafa] dark:bg-[#121c27] flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="link"
              className="text-[#0972d3] dark:text-[#42a5f5] text-xs font-bold"
              onClick={() => setDialogMode(null)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={handleDeleteRecords}
              disabled={actionLoading}
              className="bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white rounded-full font-bold text-xs py-2 px-6 shadow-sm transition-colors disabled:opacity-50"
            >
              {actionLoading ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Hosted Zone Modal (Exact AWS Console Replica) */}
      <Dialog open={deleteZoneModalOpen} onOpenChange={setDeleteZoneModalOpen}>
        <DialogContent className="sm:max-w-[480px] border border-[#d5dbdb] dark:border-gray-700 bg-white dark:bg-[#16212e] text-[#16191f] dark:text-gray-100 shadow-xl p-0 gap-0 rounded-lg overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-[#eaeded] dark:border-gray-800">
            <DialogTitle className="text-base font-bold">
              Delete hosted zone {domainClean}?
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <p className="text-xs text-[#16191f] dark:text-gray-200 leading-relaxed">
              Delete the hosted zone permanently? This action cannot be undone. Your domain might become unavailable on the internet.
            </p>

            <div className="space-y-2 pt-2">
              <Label className="text-xs text-[#16191f] dark:text-gray-200 font-normal">
                To confirm that you want to delete the hosted zone, enter <span className="italic font-bold">delete</span> in the field.
              </Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="delete"
                className="h-9 text-xs border border-[#7d8998] dark:border-gray-700 bg-white dark:bg-[#121c27] focus-visible:ring-1 focus-visible:ring-[#0972d3] rounded-sm font-sans"
              />
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-[#eaeded] dark:border-gray-800 bg-[#fafafa] dark:bg-[#121c27] flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="link"
              className="text-[#0972d3] dark:text-[#42a5f5] text-xs font-bold"
              onClick={() => setDeleteZoneModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <button
              type="button"
              disabled={deleteConfirmText.trim().toLowerCase() !== "delete" || actionLoading}
              onClick={handleDeleteZone}
              className="bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white font-bold text-xs py-2 px-6 rounded-full shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import BIND Modal */}
      <Dialog open={dialogMode === "import"} onOpenChange={() => setDialogMode(null)}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-[#16212e] text-[#16191f] dark:text-gray-100 p-0 gap-0 border border-[#d5dbdb] dark:border-gray-700 shadow-xl">
          <DialogHeader className="px-6 py-4 border-b border-[#eaeded] dark:border-gray-800">
            <DialogTitle className="text-base font-bold">Import BIND zone file</DialogTitle>
            <DialogDescription className="text-xs text-[#5f6b7a] dark:text-gray-400">
              Paste standard RFC 1035 zone file content to import records into {domainClean}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4">
            <Textarea
              value={bindContent}
              onChange={(e) => {
                setBindContent(e.target.value)
                const parsed = parseBindZone(e.target.value, zone?.name)
                setParsedBindRecords(parsed)
              }}
              rows={8}
              placeholder={`$ORIGIN ${zone?.name || "example.com."}\n$TTL 300\n@   IN  A     192.0.2.1\nwww IN  CNAME example.com.`}
              className="font-mono text-xs"
            />

            {parsedBindRecords.length > 0 && (
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                Parsed {parsedBindRecords.length} record(s) ready to import.
              </p>
            )}

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="link"
                className="text-[#0972d3] text-xs font-bold"
                onClick={() => setDialogMode(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={parsedBindRecords.length === 0 || actionLoading}
                onClick={async () => {
                  setActionLoading(true)
                  try {
                    for (const r of parsedBindRecords) {
                      await apiFetch(`/hosted-zones/${zoneId}/records`, {
                        method: "POST",
                        body: JSON.stringify({
                          name: r.name,
                          type: r.type,
                          value: r.value,
                          ttl: r.ttl,
                          priority: r.priority,
                          weight: r.weight,
                          port: r.port,
                        }),
                      })
                    }
                    toast({
                      title: "Import complete",
                      description: `Imported ${parsedBindRecords.length} records from BIND zone.`,
                      variant: "success",
                    })
                    setDialogMode(null)
                    fetchAll()
                  } catch {
                    toast({ title: "Import error", variant: "destructive" })
                  } finally {
                    setActionLoading(false)
                  }
                }}
                variant="aws"
                size="sm"
                className="rounded-full font-bold text-xs"
              >
                {actionLoading ? "Importing…" : "Import records"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
