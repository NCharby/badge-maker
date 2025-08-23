'use client'

import { useBadgeStore } from '@/hooks/useBadgeStore'
import { Card, CardContent } from '@/components/atoms/card'

export function BadgePreview() {
  const { data, croppedImage } = useBadgeStore()

  return (
    <div className="flex justify-center">
      <div className="w-80 h-96 bg-yellow-400 rounded-lg shadow-lg p-6 flex flex-col items-center justify-center space-y-6">
        {/* Badge Name */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black">
            {data.badge_name || '[Badge Name]'}
          </h2>
        </div>

        {/* Photo Placeholder */}
        <div className="w-32 h-32 rounded-full bg-gray-600 flex items-center justify-center">
          {croppedImage ? (
            <img
              src={URL.createObjectURL(croppedImage)}
              alt="Profile"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span className="text-4xl text-white font-bold">?</span>
          )}
        </div>

        {/* Social Media Handles */}
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center space-x-2">
            <span className="text-black font-bold">X</span>
            <span className="text-black">@SocialHandle1</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-black font-bold">X</span>
            <span className="text-black">@SocialHandle2</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <span className="text-black font-bold">X</span>
            <span className="text-black">@SocialHandle3</span>
          </div>
        </div>
      </div>
    </div>
  )
}
