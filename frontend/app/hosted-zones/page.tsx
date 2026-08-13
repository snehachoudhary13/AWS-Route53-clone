"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { useToast } from "@/hooks/use-toast"
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts"
import { exportMultipleZonesAsJSON } from "@/lib/export"
import { BulkActionBar } from "@/components/BulkActionBar"
import {
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  AlertTriangle,
  ExternalLink,
  Download,
  CheckCircle2,
  X,
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface HostedZone {
  id: number
  name: string
  type: string
  comment: string | null
  created_at: string
  updated_at: string
  record_count: number
}

type DialogMode = "create" | "edit" | "delete" | null

// ─── Helpers ───────────────────────────────────────────────────────────────────

function zoneId(id: number) {
  return `Z${String(id).padStart(4, "0")}${id * 9382103}`
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function HostedZonesPage() {
  const router = useRouter()
  const { toast } = useToast()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Data state ────────────────────────────────────────────────────────────
  const [zones, setZones] = useState<HostedZone[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  // ── Dialog / form state ───────────────────────────────────────────────────
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [formName, setFormName] = useState("")
  const [formType, setFormType] = useState<"Public" | "Private">("Public")
  const [formComment, setFormComment] = useState("")
  const [formNameError, setFormNameError] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchZones = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.append("search", search)
      params.append("page", page.toString())
      params.append("limit", PAGE_SIZE.toString())

      const data = await apiFetch<{ zones: HostedZone[]; total: number }>(
        `/hosted-zones?${params.toString()}`
      )
      setZones(data.zones)
      setTotal(data.total)
    } catch (err: unknown) {
      toast({
        title: "Failed to load hosted zones",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [search, page, toast])

  useEffect(() => {
    fetchZones()
  }, [fetchZones])

  // ── Selection helpers ──────────────────────────────────────────────────────
  const allSelected = zones.length > 0 && selectedIds.size === zones.length
  const someSelected = selectedIds.size > 0 && !allSelected

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(zones.map((z) => z.id)))
    }
  }

  const toggleRow = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const selectedZones = zones.filter((z) => selectedIds.has(z.id))
  const singleSelected = selectedZones.length === 1 ? selectedZones[0] : null

  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [successBannerMessage, setSuccessBannerMessage] = useState<string | null>(null)

  // ── Dialog openers ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setFormName("")
    setFormType("Public")
    setFormComment("")
    setFormNameError("")
    setDialogMode("create")
  }

  const openEdit = () => {
    if (!singleSelected) return
    setFormName(singleSelected.name)
    setFormType(singleSelected.type as "Public" | "Private")
    setFormComment(singleSelected.comment ?? "")
    setFormNameError("")
    setDialogMode("edit")
  }

  const openDelete = () => {
    if (selectedIds.size === 0) return
    setDeleteConfirmText("")
    setDialogMode("delete")
  }

  const closeDialog = () => {
    if (actionLoading) return
    setDialogMode(null)
    setDeleteConfirmText("")
  }

  // ── Export Zones ───────────────────────────────────────────────────────────
  const handleExportZones = async (onlySelected = false) => {
    try {
      let exportList: Array<{ id: number; name: string; type: string; comment: string | null; created_at: string }> = []

      if (onlySelected && selectedZones.length > 0) {
        exportList = selectedZones.map((z) => ({
          id: z.id,
          name: z.name,
          type: z.type,
          comment: z.comment,
          created_at: z.created_at,
        }))
      } else {
        // Fetch all zones across pagination to ensure complete export
        try {
          const res = await apiFetch<{ zones: HostedZone[] }>("/hosted-zones?limit=500")
          exportList = (res.zones && res.zones.length > 0 ? res.zones : zones).map((z) => ({
            id: z.id,
            name: z.name,
            type: z.type,
            comment: z.comment,
            created_at: z.created_at,
          }))
        } catch {
          exportList = zones.map((z) => ({
            id: z.id,
            name: z.name,
            type: z.type,
            comment: z.comment,
            created_at: z.created_at,
          }))
        }
      }

      if (exportList.length === 0) {
        toast({
          title: "No hosted zones to export",
          description: "Create a hosted zone first before exporting.",
          variant: "destructive",
        })
        return
      }

      exportMultipleZonesAsJSON(exportList)
      toast({
        title: "Export complete",
        description: `Exported ${exportList.length} hosted zone(s) as JSON.`,
        variant: "success",
      })
    } catch {
      toast({
        title: "Export failed",
        description: "An error occurred while generating the JSON export.",
        variant: "destructive",
      })
    }
  }

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
  useKeyboardShortcuts([
    {
      key: "/",
      description: "Focus search bar",
      action: () => searchInputRef.current?.focus(),
    },
    {
      key: "n",
      description: "Create hosted zone",
      action: () => openCreate(),
    },
    {
      key: "e",
      description: "Edit selected zone",
      action: () => {
        if (singleSelected) openEdit()
      },
    },
    {
      key: "r",
      description: "Refresh zones list",
      action: () => fetchZones(),
    },
    {
      key: "a",
      description: "Select / Deselect all",
      action: () => toggleAll(),
    },
    {
      key: "Delete",
      description: "Delete selected zone(s)",
      action: () => {
        if (selectedIds.size > 0) openDelete()
      },
    },
    {
      key: "Backspace",
      description: "Delete selected zone(s)",
      action: () => {
        if (selectedIds.size > 0) openDelete()
      },
    },
    {
      key: "Escape",
      description: "Clear selection or close dialog",
      action: () => {
        if (dialogMode) setDialogMode(null)
        else setSelectedIds(new Set())
      },
    },
  ])

  // ── Form validation ────────────────────────────────────────────────────────
  const validateName = (value: string) => {
    if (!value.trim()) return "Domain name is required."
    if (!/^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\.?$/.test(value.trim())) {
      return "Enter a valid domain name (e.g. example.com)."
    }
    return ""
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateName(formName)
    if (err) { setFormNameError(err); return }

    setActionLoading(true)
    try {
      const cleanName = formName.trim().replace(/\.$/, "")
      const createdZone = await apiFetch<{ id: number; name: string }>("/hosted-zones", {
        method: "POST",
        body: JSON.stringify({
          name: cleanName + ".",
          type: formType,
          comment: formComment.trim() || null,
        }),
      })
      setDialogMode(null)
      setSelectedIds(new Set())
      router.push(`/hosted-zones/${createdZone.id}?created=true&name=${encodeURIComponent(cleanName)}`)
    } catch (err: unknown) {
      toast({
        title: "Failed to create hosted zone",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!singleSelected) return

    setActionLoading(true)
    try {
      await apiFetch(`/hosted-zones/${singleSelected.id}`, {
        method: "PUT",
        body: JSON.stringify({
          type: formType,
          comment: formComment.trim() || null,
        }),
      })
      toast({
        title: "Hosted zone updated",
        description: `${singleSelected.name} has been updated.`,
        variant: "success",
      })
      setDialogMode(null)
      fetchZones()
    } catch (err: unknown) {
      toast({
        title: "Failed to update hosted zone",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDelete = async () => {
    if (deleteConfirmText.trim().toLowerCase() !== "delete") return
    setActionLoading(true)
    try {
      const deletedNames = selectedZones.map((z) => z.name.replace(/\.$/, "")).join(", ")
      for (const id of Array.from(selectedIds)) {
        await apiFetch(`/hosted-zones/${id}`, { method: "DELETE" })
      }
      setSuccessBannerMessage(`Hosted zone ${deletedNames || "zone"} was successfully deleted.`)
      setSelectedIds(new Set())
      setDialogMode(null)
      setDeleteConfirmText("")
      fetchZones()
    } catch (err: unknown) {
      toast({
        title: "Failed to delete hosted zone(s)",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setActionLoading(false)
    }
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasPrev = page > 1
  const hasNext = page < totalPages

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-4">
        {/* AWS Green Success Alert Banner */}
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

        {/* Page title */}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#16191f] dark:text-gray-100">
              Hosted zones{" "}
              <span className="text-base font-normal text-[#5f6b7a] dark:text-gray-400">({total})</span>
            </h1>
            <span className="text-[#0972d3] text-xs font-medium cursor-pointer hover:underline">
              Info
            </span>
          </div>
          <p className="text-xs text-[#5f6b7a] dark:text-gray-400 mt-1">
            Automatic mode is the current search behavior optimized for best filter results.{" "}
            <span className="text-[#0972d3] dark:text-[#42a5f5] cursor-pointer hover:underline">
              To change modes go to settings.
            </span>
          </p>
        </div>

        {/* Table card */}
        <div className="border border-[#d5dbdb] dark:border-[#2a3747] rounded-sm bg-white dark:bg-[#16212e] shadow-sm transition-colors">
          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-[#eaeded] dark:border-[#2a3747] flex flex-col sm:flex-row sm:items-center gap-3 bg-[#fafafa] dark:bg-[#121c27]">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#5f6b7a] dark:text-gray-400" />
              <Input
                ref={searchInputRef}
                id="hosted-zones-search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                placeholder="Filter records by property or value"
                className="pl-8 h-8 text-xs border-[#aab7b8] dark:border-gray-700 dark:bg-[#16212e] dark:text-gray-100 focus-visible:ring-[#0972d3] focus-visible:border-[#0972d3] rounded-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Refresh */}
              <Button
                id="refresh-zones"
                variant="aws-outline"
                size="sm"
                onClick={fetchZones}
                title="Refresh (r)"
                className="h-8 w-8 p-0 rounded-full dark:border-gray-700 dark:bg-[#16212e] dark:hover:bg-gray-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-[#0972d3]" : ""}`} />
              </Button>

              {/* View details */}
              <Button
                id="view-zone-details"
                variant="aws-outline"
                size="sm"
                disabled={selectedIds.size !== 1}
                onClick={() => singleSelected && router.push(`/hosted-zones/${singleSelected.id}`)}
                className="h-8 text-xs rounded-full dark:border-gray-700 dark:bg-[#16212e] dark:hover:bg-gray-800"
              >
                View details
              </Button>

              {/* Edit */}
              <Button
                id="edit-zone"
                variant="aws-outline"
                size="sm"
                disabled={selectedIds.size !== 1}
                onClick={openEdit}
                className="h-8 text-xs rounded-full dark:border-gray-700 dark:bg-[#16212e] dark:hover:bg-gray-800"
                title="Edit zone (e)"
              >
                Edit
              </Button>

              {/* Delete */}
              <Button
                id="delete-zones"
                variant="aws-outline"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={openDelete}
                className="h-8 text-xs rounded-full dark:border-gray-700 dark:bg-[#16212e] dark:hover:bg-gray-800"
                title="Delete selected (Del)"
              >
                Delete
              </Button>

              {/* Export Button */}
              <Button
                id="export-zones"
                variant="aws-outline"
                size="sm"
                onClick={() => handleExportZones(selectedIds.size > 0)}
                className="h-8 text-xs rounded-full dark:border-gray-700 dark:bg-[#16212e] dark:hover:bg-gray-800"
                title="Export hosted zones as JSON"
              >
                <Download className="h-3.5 w-3.5 mr-1" />
                {selectedIds.size > 0 ? `Export (${selectedIds.size})` : "Export all"}
              </Button>

              {/* Create */}
              <Button
                id="create-zone"
                variant="aws"
                size="sm"
                onClick={openCreate}
                className="h-8 text-xs rounded-full font-bold px-4"
                title="Create hosted zone (n)"
              >
                Create hosted zone
              </Button>

              {/* Pagination */}
              <div className="flex items-center gap-1 border-l border-[#d5dbdb] dark:border-gray-700 pl-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!hasPrev}
                  onClick={() => setPage((p) => p - 1)}
                  title="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="text-xs text-[#16191f] dark:text-gray-300 font-medium px-1">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!hasNext}
                  onClick={() => setPage((p) => p + 1)}
                  title="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <Table>
            <TableHeader>
              <TableRow className="bg-[#f2f3f3] dark:bg-[#121c27] border-b border-[#eaeded] dark:border-[#2a3747] hover:bg-[#f2f3f3] dark:hover:bg-[#121c27]">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    id="select-all-zones"
                    checked={allSelected}
                    data-state={someSelected ? "indeterminate" : allSelected ? "checked" : "unchecked"}
                    onCheckedChange={toggleAll}
                    aria-label="Select all zones (a)"
                  />
                </TableHead>
                <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3">
                  Hosted zone name ▼
                </TableHead>
                <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3">
                  Type ▼
                </TableHead>
                <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3">
                  Record count ▼
                </TableHead>
                <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3">
                  Description ▼
                </TableHead>
                <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 border-r border-[#eaeded] dark:border-[#2a3747] px-3">
                  Created by ▼
                </TableHead>
                <TableHead className="text-xs font-bold text-[#16191f] dark:text-gray-200 px-3">
                  Hosted zone ID ▼
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                /* ── Skeleton rows ── */
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skel-${i}`} className="border-b border-[#eaeded] dark:border-[#2a3747]">
                    <TableCell className="px-3 py-3"><div className="h-4 w-4 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse" /></TableCell>
                    <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-40" /></TableCell>
                    <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-5 rounded-full bg-[#eaeded] dark:bg-gray-800 animate-pulse w-14" /></TableCell>
                    <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-8" /></TableCell>
                    <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-32" /></TableCell>
                    <TableCell className="px-3 py-3 border-r border-[#eaeded] dark:border-[#2a3747]"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-16" /></TableCell>
                    <TableCell className="px-3 py-3"><div className="h-3 rounded bg-[#eaeded] dark:bg-gray-800 animate-pulse w-28" /></TableCell>
                  </TableRow>
                ))
              ) : zones.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-14">
                    <div className="max-w-md mx-auto text-center space-y-3.5">
                      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#f2f3f3] dark:bg-gray-800 border border-[#d5dbdb] dark:border-gray-700">
                        <svg className="w-7 h-7 text-[#5f6b7a] dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-[#16191f] dark:text-gray-100">
                          {search ? "No results" : "No hosted zones"}
                        </h3>
                        <p className="text-xs text-[#5f6b7a] dark:text-gray-400 mt-1 max-w-sm mx-auto leading-relaxed">
                          {search
                            ? `No zones match "${search}". Try adjusting your search query or clear the filter.`
                            : "There are no hosted zones created for this account."}
                        </p>
                      </div>
                      {!search && (
                        <div className="pt-1">
                          <Button variant="aws" size="sm" className="rounded-full font-bold text-xs px-5 shadow-sm" onClick={openCreate}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Create hosted zone
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                zones.map((zone) => {
                  const selected = selectedIds.has(zone.id)
                  return (
                    <TableRow
                      key={zone.id}
                      data-state={selected ? "selected" : undefined}
                      className={`border-b border-[#eaeded] dark:border-[#2a3747] cursor-pointer transition-colors ${
                        selected
                          ? "bg-[#f0f4ff] dark:bg-[#1f2d3d]"
                          : "hover:bg-[#f8f9fa] dark:hover:bg-[#192635]"
                      }`}
                      onClick={() => toggleRow(zone.id)}
                    >
                      <TableCell className="px-3 py-2.5">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleRow(zone.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${zone.name}`}
                        />
                      </TableCell>
                      <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] font-semibold text-xs">
                        <Link
                          href={`/hosted-zones/${zone.id}`}
                          className="text-[#0972d3] dark:text-[#42a5f5] hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {zone.name}
                        </Link>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs">
                        <Badge
                          variant={zone.type === "Public" ? "public" : "private"}
                          className="text-[10px] font-semibold"
                        >
                          {zone.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#16191f] dark:text-gray-200">
                        {zone.record_count}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#5f6b7a] dark:text-gray-400 max-w-xs truncate">
                        {zone.comment || <span className="text-[#aab7b8] dark:text-gray-600">—</span>}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 border-r border-[#eaeded] dark:border-[#2a3747] text-xs text-[#5f6b7a] dark:text-gray-400 font-mono">
                        admin
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-xs font-mono text-[#5f6b7a] dark:text-gray-400">
                        {zoneId(zone.id)}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Footer pagination row */}
          {total > PAGE_SIZE && (
            <div className="px-4 py-2.5 border-t border-[#eaeded] dark:border-[#2a3747] flex items-center justify-between bg-[#fafafa] dark:bg-[#121c27] text-xs text-[#5f6b7a] dark:text-gray-400">
              <span>
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, total)}–
                {Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!hasPrev} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce<(number | "…")[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…")
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`ellipsis-${i}`} className="px-1">…</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "ghost"}
                        size="icon"
                        className={`h-7 w-7 text-xs ${p === page ? "bg-[#0972d3] text-white hover:bg-[#0860a8]" : ""}`}
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Bulk Actions Floating Toolbar ────────────────────────────────────── */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        itemLabel="hosted zones"
        onClear={() => setSelectedIds(new Set())}
        onDelete={openDelete}
        onBulkExport={() => handleExportZones(true)}
        loading={actionLoading}
      />

      {/* ── Create / Edit Dialog ─────────────────────────────────────────────── */}
      <Dialog open={dialogMode === "create" || dialogMode === "edit"} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[520px] border border-[#d5dbdb] dark:border-gray-700 bg-white dark:bg-[#16212e] text-[#16191f] dark:text-gray-100 shadow-xl p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-[#eaeded] dark:border-gray-800">
            <DialogTitle className="text-base font-bold">
              {dialogMode === "create" ? "Create hosted zone" : `Edit: ${singleSelected?.name}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#5f6b7a] dark:text-gray-400 mt-0.5">
              {dialogMode === "create"
                ? "Create a new Route 53 hosted zone to manage DNS records for your domain."
                : "Update the type or description for this hosted zone."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={dialogMode === "create" ? handleCreate : handleEdit}>
            <div className="px-6 py-5 space-y-5">
              {/* Domain name — create only */}
              {dialogMode === "create" && (
                <div className="space-y-1.5">
                  <Label htmlFor="zone-name" className="text-xs font-bold">
                    Domain name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="zone-name"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value)
                      setFormNameError("")
                    }}
                    placeholder="example.com"
                    className={`text-xs h-8 border-[#aab7b8] dark:border-gray-700 dark:bg-[#121c27] focus-visible:ring-[#0972d3] ${formNameError ? "border-red-500" : ""}`}
                    autoFocus
                  />
                  {formNameError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{formNameError}</p>
                  )}
                  <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400">
                    Enter the name of the domain or subdomain (e.g., example.com).
                  </p>
                </div>
              )}

              {/* Type */}
              <div className="space-y-1.5">
                <Label htmlFor="zone-type" className="text-xs font-bold">
                  Type
                </Label>
                <Select value={formType} onValueChange={(v) => setFormType(v as "Public" | "Private")}>
                  <SelectTrigger
                    id="zone-type"
                    className="h-8 text-xs border-[#aab7b8] dark:border-gray-700 dark:bg-[#121c27] focus:ring-[#0972d3]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-[#16212e] dark:border-gray-700">
                    <SelectItem value="Public" className="text-xs">
                      Public hosted zone
                    </SelectItem>
                    <SelectItem value="Private" className="text-xs">
                      Private hosted zone
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400">
                  {formType === "Public"
                    ? "Routes traffic on the internet. Records are publicly accessible."
                    : "Routes traffic within one or more Amazon VPCs."}
                </p>
              </div>

              {/* Comment */}
              <div className="space-y-1.5">
                <Label htmlFor="zone-comment" className="text-xs font-bold">
                  Description
                </Label>
                <Textarea
                  id="zone-comment"
                  value={formComment}
                  onChange={(e) => setFormComment(e.target.value)}
                  placeholder="Enter a description for this hosted zone…"
                  maxLength={256}
                  rows={3}
                  className="text-xs border-[#aab7b8] dark:border-gray-700 dark:bg-[#121c27] focus-visible:ring-[#0972d3] resize-none"
                />
                <p className="text-[11px] text-[#5f6b7a] dark:text-gray-400 text-right">
                  {formComment.length}/256
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t border-[#eaeded] dark:border-gray-800 bg-[#fafafa] dark:bg-[#121c27]">
              <Button
                type="button"
                variant="link"
                className="text-[#0972d3] dark:text-[#42a5f5] text-xs font-bold"
                onClick={closeDialog}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="aws"
                size="sm"
                disabled={actionLoading}
                className="rounded-full font-bold text-xs"
              >
                {actionLoading
                  ? dialogMode === "create" ? "Creating…" : "Saving…"
                  : dialogMode === "create" ? "Create hosted zone" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog (Exact AWS Console Replica) ──────────── */}
      <Dialog open={dialogMode === "delete"} onOpenChange={closeDialog}>
        <DialogContent className="sm:max-w-[480px] border border-[#d5dbdb] dark:border-gray-700 bg-white dark:bg-[#16212e] text-[#16191f] dark:text-gray-100 shadow-xl p-0 gap-0 rounded-lg overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b border-[#eaeded] dark:border-gray-800 flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold">
              Delete hosted zone {selectedZones.map((z) => z.name.replace(/\.$/, "")).join(", ")}?
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
              onClick={closeDialog}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <button
              type="button"
              disabled={deleteConfirmText.trim().toLowerCase() !== "delete" || actionLoading}
              onClick={handleDelete}
              className="bg-[#ec7211] hover:bg-[#eb5f07] active:bg-[#d8650c] text-white font-bold text-xs py-2 px-6 rounded-full shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {actionLoading ? "Deleting…" : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
