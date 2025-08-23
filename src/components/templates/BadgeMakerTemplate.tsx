import { BadgeCreationForm } from '@/components/organisms/BadgeCreationForm'
import { BadgePreview } from '@/components/organisms/BadgePreview'

export function BadgeMakerTemplate() {
  return (
    <main className="min-h-screen bg-[#2d2d2d]">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex-1">
            <h1 className="text-[64px] font-normal text-white mb-3 font-montserrat leading-[normal]">
              BADGE-O-MATIC
            </h1>
          </div>
        </div>

        {/* Main Content */}
        <BadgeCreationForm />
      </div>
    </main>
  )
}
