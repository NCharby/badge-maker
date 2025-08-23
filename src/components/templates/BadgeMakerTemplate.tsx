import { ReactNode } from 'react'
import { ThemeToggle } from '@/components/atoms/theme-toggle'

interface BadgeMakerTemplateProps {
  children: ReactNode
  title?: string
  subtitle?: string
}

export function BadgeMakerTemplate({ 
  children, 
  title = "BADGE-O-MATIC",
  subtitle = "Create your conference badge with a live preview"
}: BadgeMakerTemplateProps) {
  return (
    <main className="min-h-screen bg-[#2d2d2d]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <div className="text-center flex-1">
            <h1 className="text-[64px] font-normal text-white mb-3 font-montserrat leading-[normal]">
              {title}
            </h1>
          </div>
          <div className="flex-shrink-0">
            <ThemeToggle />
          </div>
        </div>

        {children}
      </div>
    </main>
  )
}
