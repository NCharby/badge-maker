import { ReactNode } from 'react'

interface BadgeMakerTemplateProps {
  children: ReactNode
  title?: string
  subtitle?: string
}

export function BadgeMakerTemplate({ 
  children, 
  title = "Badge Maker",
  subtitle = "Create your conference badge with a live preview"
}: BadgeMakerTemplateProps) {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            {title}
          </h1>
          <p className="text-lg text-gray-600">
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </main>
  )
}
