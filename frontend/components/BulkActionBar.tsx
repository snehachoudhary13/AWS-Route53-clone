"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { X, Trash2, Clock, Download, Layers } from "lucide-react"

interface BulkActionBarProps {
  selectedCount: number
  itemLabel?: string
  onClear: () => void
  onDelete: () => void
  onBulkUpdateTtl?: (ttl: number) => Promise<void>
  onBulkExport?: () => void
  loading?: boolean
}

export function BulkActionBar({
  selectedCount,
  itemLabel = "items",
  onClear,
  onDelete,
  onBulkUpdateTtl,
  onBulkExport,
  loading = false,
}: BulkActionBarProps) {
  const [ttlValue, setTtlValue] = useState<number>(300)
  const [showTtlInput, setShowTtlInput] = useState(false)
  const [ttlLoading, setTtlLoading] = useState(false)

  if (selectedCount < 2) return null

  const handleApplyTtl = async () => {
    if (!onBulkUpdateTtl || !ttlValue) return
    setTtlLoading(true)
    try {
      await onBulkUpdateTtl(Number(ttlValue))
      setShowTtlInput(false)
    } finally {
      setTtlLoading(false)
    }
  }

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-[#0f1b2a] text-white border border-[#2a3747] shadow-2xl rounded-full px-5 py-2.5 flex items-center gap-4 text-xs animate-in slide-in-from-bottom-5 duration-200">
      {/* Count */}
      <div className="flex items-center gap-2 font-bold border-r border-[#2a3747] pr-4">
        <Layers className="w-4 h-4 text-[#ff9900]" />
        <span>
          {selectedCount} {itemLabel} selected
        </span>
      </div>

      {/* Bulk TTL editor */}
      {onBulkUpdateTtl && (
        <div className="flex items-center gap-2">
          {showTtlInput ? (
            <div className="flex items-center gap-1.5 bg-[#16212e] border border-[#2a3747] rounded-full px-2 py-1">
              <span className="text-[11px] text-gray-400 pl-1">TTL:</span>
              <Input
                type="number"
                min={1}
                value={ttlValue}
                onChange={(e) => setTtlValue(Number(e.target.value))}
                className="h-6 w-16 text-xs text-white bg-transparent border-0 focus-visible:ring-0 p-0 text-center font-mono"
                autoFocus
              />
              <Button
                size="sm"
                variant="aws"
                disabled={ttlLoading || loading}
                onClick={handleApplyTtl}
                className="h-5 px-2 text-[10px] rounded-full font-bold"
              >
                {ttlLoading ? "Saving…" : "Apply"}
              </Button>
              <button
                onClick={() => setShowTtlInput(false)}
                className="text-gray-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="aws-outline"
              disabled={loading}
              onClick={() => setShowTtlInput(true)}
              className="h-7 text-xs bg-[#16212e] hover:bg-[#1f2d3d] text-gray-200 border-[#2a3747] rounded-full font-medium"
            >
              <Clock className="w-3.5 h-3.5 mr-1 text-[#0972d3]" />
              Update TTL
            </Button>
          )}
        </div>
      )}

      {/* Bulk Export */}
      {onBulkExport && (
        <Button
          size="sm"
          variant="aws-outline"
          disabled={loading}
          onClick={onBulkExport}
          className="h-7 text-xs bg-[#16212e] hover:bg-[#1f2d3d] text-gray-200 border-[#2a3747] rounded-full font-medium"
        >
          <Download className="w-3.5 h-3.5 mr-1 text-gray-300" />
          Export selected
        </Button>
      )}

      {/* Bulk Delete */}
      <Button
        size="sm"
        variant="destructive"
        disabled={loading}
        onClick={onDelete}
        className="h-7 text-xs rounded-full font-bold px-3"
      >
        <Trash2 className="w-3.5 h-3.5 mr-1" />
        Delete ({selectedCount})
      </Button>

      {/* Deselect All */}
      <button
        onClick={onClear}
        className="text-gray-400 hover:text-white p-1 rounded-full hover:bg-gray-800 transition-colors"
        title="Clear selection (Esc)"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
