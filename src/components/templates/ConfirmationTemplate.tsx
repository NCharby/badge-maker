'use client'

import { ReactNode } from 'react'

interface ConfirmationTemplateProps {
  children: ReactNode
}

export function ConfirmationTemplate({ children }: ConfirmationTemplateProps) {
  return (
    <main className="min-h-screen bg-[#2d2d2d]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex-1">
            <h1 className="text-[64px] font-normal text-white mb-3 font-montserrat leading-[normal]">
              BADGE-O-MATIC
            </h1>
          </div>
        </div>

        {/* Main Content */}
        {children}
      </div>
    </main>
  )
}
