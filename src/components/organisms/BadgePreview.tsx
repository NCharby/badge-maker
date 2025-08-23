'use client'

import { useBadgeStore } from '@/hooks/useBadgeStore'
import { Card, CardContent } from '@/components/atoms/card'

export function BadgePreview() {
  const { data, croppedImage } = useBadgeStore()

  return (
    <div className="flex justify-center">
      <Card className="w-80 h-48 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
        <CardContent className="p-6 h-full flex flex-col justify-between">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">Conference Badge</h2>
            <p className="text-sm opacity-90">2024</p>
          </div>

          {/* Main Content */}
          <div className="flex items-center space-x-4">
            {/* Photo */}
            <div className="w-16 h-16 rounded-full bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
              {croppedImage ? (
                <img
                  src={URL.createObjectURL(croppedImage)}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-2xl opacity-50">👤</div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <h3 className="font-semibold text-lg">
                {data.badge_name || 'Your Name'}
              </h3>
              <p className="text-sm opacity-90">
                {data.email || 'email@example.com'}
              </p>
            </div>
          </div>

          {/* Social Media */}
          {data.social_media_handles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.social_media_handles.map((handle, index) => (
                <div
                  key={index}
                  className="text-xs bg-primary-foreground/20 px-2 py-1 rounded"
                >
                  {handle.platform}: {handle.handle}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
