'use client'

import { ReactNode } from 'react'

interface ConfirmationTemplateProps {
  children: ReactNode
}

export function ConfirmationTemplate({ children }: ConfirmationTemplateProps) {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        
        {/* Main Content */}
        {children}
      </div>
    </main>
  )
}
