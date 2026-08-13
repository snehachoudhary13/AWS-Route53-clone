"use client"

import { useEffect } from "react"

export interface ShortcutConfig {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  description: string
  action: (e: KeyboardEvent) => void
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, select, or contenteditable
      const target = e.target as HTMLElement | null
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)

      for (const shortcut of shortcuts) {
        const matchesKey = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const matchesCtrl = shortcut.ctrl ? e.ctrlKey : true
        const matchesMeta = shortcut.meta ? e.metaKey : true
        const matchesShift = shortcut.shift ? e.shiftKey : !e.shiftKey || shortcut.key === "?"
        const matchesAlt = shortcut.alt ? e.altKey : !e.altKey

        // If typing in input, only allow Escape or specific shortcuts if explicitly desired
        if (isInput && e.key !== "Escape") {
          continue
        }

        if (matchesKey && matchesCtrl && matchesMeta && matchesShift && matchesAlt) {
          e.preventDefault()
          shortcut.action(e)
          break
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts, enabled])
}
