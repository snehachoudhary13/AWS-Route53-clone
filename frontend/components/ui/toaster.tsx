"use client"

import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react"

export function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-2 max-w-md w-full pointer-events-none">
      {toasts.map((t) => {
        const isDestructive = t.variant === "destructive"
        const isSuccess     = t.variant === "success"
        // default / info → AWS-blue tint
        const isInfo        = !isDestructive && !isSuccess

        return (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded border shadow-lg flex items-start gap-3 text-xs transition-all ${
              isDestructive
                ? "bg-red-50 border-red-300 text-red-900"
                : isSuccess
                ? "bg-[#d6f5e3] border-[#1e8e3e] text-[#16191f]"
                : "bg-[#f1f8fa] border-[#0073bb] text-[#0f1b2a]"
            }`}
          >
            {/* Icon */}
            {isSuccess     && <CheckCircle2 className="w-4 h-4 text-[#1e8e3e] mt-0.5 shrink-0" />}
            {isDestructive && <AlertCircle  className="w-4 h-4 text-red-600   mt-0.5 shrink-0" />}
            {isInfo        && <Info         className="w-4 h-4 text-[#0073bb] mt-0.5 shrink-0" />}

            {/* Content */}
            <div className="flex-1 min-w-0">
              {t.title       && <h4 className="font-bold mb-0.5 leading-tight">{t.title}</h4>}
              {t.description && <p className="opacity-90 leading-snug">{t.description}</p>}
            </div>

            {/* Dismiss */}
            <button
              onClick={() => dismiss(t.id)}
              className="text-gray-400 hover:text-gray-700 p-0.5 shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
