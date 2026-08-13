"use client"

import { Terminal, MessageSquare, Smartphone, ShieldCheck } from "lucide-react"

export function Footer() {
  return (
    <footer className="h-8 bg-[#0f1b2a] text-gray-400 text-[11px] px-4 flex items-center justify-between border-t border-[#19212c] shrink-0 z-40 select-none">
      <div className="flex items-center space-x-4">
        <button className="flex items-center space-x-1.5 hover:text-white transition-colors">
          <Terminal className="w-3 h-3 text-[#ff9900]" />
          <span>CloudShell</span>
        </button>
        <button className="flex items-center space-x-1.5 hover:text-white transition-colors hidden sm:flex">
          <ShieldCheck className="w-3 h-3 text-[#0073bb]" />
          <span>Agent Toolkit for AWS</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-white transition-colors">
          <MessageSquare className="w-3 h-3" />
          <span>Feedback</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-white transition-colors hidden md:flex">
          <Smartphone className="w-3 h-3" />
          <span>Console Mobile App</span>
        </button>
      </div>

      <div className="flex items-center space-x-3 text-gray-400">
        <span>© 2026, Amazon Web Services, Inc. or its affiliates.</span>
        <span className="hover:text-white cursor-pointer hidden sm:inline">Privacy</span>
        <span className="hover:text-white cursor-pointer hidden sm:inline">Terms</span>
        <span className="hover:text-white cursor-pointer hidden md:inline">Cookie preferences</span>
      </div>
    </footer>
  )
}

export default Footer
