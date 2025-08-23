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
    <main className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">
            {title}
          </h1>
          <p className="text-lg text-muted-foreground">
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </main>
  )
}
