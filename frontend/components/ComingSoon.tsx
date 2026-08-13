"use client"

import Link from "next/link"
import { Clock, ArrowLeft } from "lucide-react"

interface ComingSoonProps {
  title: string
  description: string
}

export default function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <div className="bg-white dark:bg-[#16212e] border border-[#eaeded] dark:border-[#2a3747] rounded-sm p-8 shadow-sm max-w-4xl transition-colors">
      <div className="flex items-center space-x-3 mb-4">
        <div className="p-2.5 bg-[#f1f8fa] dark:bg-gray-800 text-[#0073bb] dark:text-[#0972d3] rounded-full">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
        </div>
      </div>

      <div className="mt-6 border-t border-[#eaeded] dark:border-[#2a3747] pt-6">
        <div className="p-4 bg-[#f2f3f3] dark:bg-[#121c27] border border-[#eaeded] dark:border-[#2a3747] rounded-sm text-xs text-gray-600 dark:text-gray-300 mb-6">
          <span className="font-semibold text-gray-800 dark:text-gray-200">Feature Status:</span> This module is currently placeholder for the AWS Route 53 Console clone. Please navigate to <strong>Hosted zones</strong> to view and test full DNS management features.
        </div>

        <Link
          href="/hosted-zones"
          className="inline-flex items-center space-x-2 bg-[#ec7211] hover:bg-[#eb5f07] text-white font-bold text-xs px-4 py-2 rounded-sm shadow-sm transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Go to Hosted zones</span>
        </Link>
      </div>
    </div>
  )
}
