import { BadgeCreationForm } from '@/components/organisms/BadgeCreationForm'
import { BadgePreview } from '@/components/organisms/BadgePreview'

export default function TestPage() {
  return (
    <div className="min-h-screen bg-[#2d2d2d] p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 text-center">Test Page</h1>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          <BadgeCreationForm />
          <BadgePreview />
        </div>
      </div>
    </div>
  )
}
