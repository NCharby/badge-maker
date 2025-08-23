'use client'

import { useBadgeStore } from '@/hooks/useBadgeStore'
import { Card, CardContent } from '@/components/atoms/card'

export function BadgePreview() {
  const { data, croppedImage } = useBadgeStore()

  return (
    <div className="flex justify-center">
      {/* Badge Container - matches Figma design */}
      <div className="bg-[#ffcc00] rounded-[20px] p-[50px_40px] flex flex-col items-center justify-start gap-[30px] w-full max-w-[587px] h-[983px]">
        {/* Badge Name */}
        <div className="text-center">
          <h2 className="text-[48px] font-normal text-black leading-[normal] font-open-sans">
            {data.badge_name || '[Badge Name]'}
          </h2>
        </div>

        {/* Photo */}
        <div className="w-[400px] h-[400px] rounded-[200px] bg-cover bg-center bg-no-repeat flex items-center justify-center">
          {croppedImage ? (
            <img
              src={URL.createObjectURL(croppedImage)}
              alt="Profile"
              className="w-full h-full object-cover rounded-[200px]"
            />
          ) : (
            <div className="w-full h-full bg-[#414042] rounded-[200px] flex items-center justify-center">
              <img
                src="/assets/question-placer@2x.png"
                alt="Question mark placeholder"
                className="w-32 h-32 object-contain"
              />
            </div>
          )}
        </div>

        {/* Social Media Handles */}
        <div className="flex flex-col gap-[18px] items-center justify-center">
          {/* Social 1 */}
          <div className="flex items-center justify-center gap-[18px]">
            <div className="w-7 h-[25px] flex items-center justify-center">
              <span className="text-black font-bold text-lg">X</span>
            </div>
            <span className="text-black text-[32px] font-normal leading-[normal] font-open-sans">
              {data.social_media_handles[0]?.handle || '@SocialHandle1'}
            </span>
          </div>

          {/* Social 2 */}
          <div className="flex items-center justify-center gap-[18px]">
            <div className="w-7 h-[25px] flex items-center justify-center">
              <span className="text-black font-bold text-lg">X</span>
            </div>
            <span className="text-black text-[32px] font-normal leading-[normal] font-open-sans">
              {data.social_media_handles[1]?.handle || '@SocialHandle2'}
            </span>
          </div>

          {/* Social 3 */}
          <div className="flex items-center justify-center gap-[18px]">
            <div className="w-7 h-[25px] flex items-center justify-center">
              <span className="text-black font-bold text-lg">X</span>
            </div>
            <span className="text-black text-[32px] font-normal leading-[normal] font-open-sans">
              {data.social_media_handles[2]?.handle || '@SocialHandle3'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
