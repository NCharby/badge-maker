'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConfirmationTemplate } from '@/components/templates/ConfirmationTemplate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card'
import { Button } from '@/components/atoms/button'
import { TelegramLinks } from '@/components/molecules/TelegramLinks'
import Link from 'next/link'
import { getSignedImageUrl } from '@/lib/utils/imageUtils'

interface BadgeData {
  id: string
  badge_name: string
  email: string
  social_media_handles: Array<{
    platform: string
    handle: string
  }>
  original_image_url?: string
  cropped_image_url?: string
  status: string
  created_at: string
}

// Platform display mapping
const platformDisplay = {
  x: 'X',
  bluesky: 'BS',
  telegram: 'TG',
  recon: 'RC',
  furaffinity: 'FA',
  fetlife: 'FL',
  discord: 'DC',
  instagram: 'IG',
  other: 'OT'
}

interface ConfirmationPageProps {
  eventSlug: string;
}

export function ConfirmationPage({ eventSlug }: ConfirmationPageProps) {
  const searchParams = useSearchParams()
  const badgeId = searchParams.get('badge_id')
  const [badgeData, setBadgeData] = useState<BadgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    const fetchBadgeData = async () => {
      if (!badgeId) {
        setError('No badge ID provided')
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/badges?id=${badgeId}`)
        if (response.ok) {
          const data = await response.json()
          setBadgeData(data.badge)
          
          // Get signed URL for the cropped image if it exists
          if (data.badge.cropped_image_url) {
            // Extract filename from the URL
            const urlParts = data.badge.cropped_image_url.split('/')
            const filename = urlParts[urlParts.length - 1]
            const signedUrl = await getSignedImageUrl(`cropped/${filename}`)
            setImageUrl(signedUrl)
          }
        } else {
          const errorData = await response.json()
          setError(errorData.error || 'Failed to fetch badge data')
        }
      } catch (err) {
        setError('An error occurred while fetching badge data')
      } finally {
        setLoading(false)
      }
    }

    fetchBadgeData()
  }, [badgeId])

  if (loading) {
    return (
      <ConfirmationTemplate>
        <Card>
          <CardContent className="flex justify-center items-center py-8">
            <p className="text-white">Loading badge data...</p>
          </CardContent>
        </Card>
      </ConfirmationTemplate>
    )
  }

  if (error) {
    return (
      <ConfirmationTemplate>
        <Card>
          <CardContent className="flex flex-col items-center py-8 space-y-4">
            <p className="text-red-400">{error}</p>
            <Link href="/">
              <Button variant="outline">
                Create New Badge
              </Button>
            </Link>
          </CardContent>
        </Card>
      </ConfirmationTemplate>
    )
  }

  return (
    <ConfirmationTemplate>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 max-w-7xl">
        {/* Badge Preview */}
        <div className="flex justify-center">
          <div className="bg-[#ffcc00] rounded-[20px] p-[50px_40px] flex flex-col items-center justify-start gap-[30px] w-full max-w-[587px] h-[983px]">
            {/* Badge Name */}
            <div className="text-center">
              <h2 className="text-[48px] font-normal text-black leading-[normal] font-open-sans">
                {badgeData?.badge_name || '[Badge Name]'}
              </h2>
            </div>

            {/* Photo */}
            <div className="w-[400px] h-[400px] rounded-[200px] bg-cover bg-center bg-no-repeat flex items-center justify-center">
              {imageUrl ? (
                <img
                  src={imageUrl}
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
              {badgeData?.social_media_handles?.map((handle, index) => (
                <div key={index} className="flex items-center justify-center gap-[18px]">
                  <div className="w-7 h-[25px] flex items-center justify-center">
                    <span className="text-black font-bold text-lg">
                      {platformDisplay[handle.platform as keyof typeof platformDisplay] || 'X'}
                    </span>
                  </div>
                  <span className="text-black text-[32px] font-normal leading-[normal] font-open-sans">
                    @{handle.handle}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Badge Details */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] h-fit">
          <CardHeader>
            <CardTitle className="text-[32px] font-normal text-white font-montserrat leading-[normal]">
              Badge Created Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {badgeData && (
              <>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-open-sans text-[16px]">Badge Name:</span>
                    <span className="text-white font-open-sans text-[16px] font-semibold">
                      {badgeData.badge_name}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-white font-open-sans text-[16px]">Email:</span>
                    <span className="text-white font-open-sans text-[16px] font-semibold">
                      {badgeData.email}
                    </span>
                  </div>

                  {badgeData.social_media_handles && badgeData.social_media_handles.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-white font-open-sans text-[16px]">Social Media Handles:</span>
                      <div className="space-y-1">
                        {badgeData.social_media_handles.map((handle, index) => (
                          <div key={index} className="flex justify-between items-center ml-4">
                            <span className="text-[#949494] font-open-sans text-[14px] capitalize">
                              {handle.platform}:
                            </span>
                            <span className="text-white font-open-sans text-[14px]">
                              @{handle.handle}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <span className="text-white font-open-sans text-[16px]">Status:</span>
                    <span className="text-green-400 font-open-sans text-[16px] font-semibold capitalize">
                      {badgeData.status}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-white font-open-sans text-[16px]">Created:</span>
                    <span className="text-white font-open-sans text-[16px]">
                      {new Date(badgeData.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="border-t border-[#5c5c5c] pt-4">
                  <p className="text-[#949494] font-open-sans text-[14px] text-center">
                    Your badge has been successfully created and saved to our database.
                    You can now proceed with your conference registration.
                  </p>
                </div>
              </>
            )}

            <div className="flex justify-center pt-4">
              <Link href="/">
                <Button 
                  variant="outline"
                  className="bg-transparent border-[#767676] text-white font-open-sans text-[16px] rounded-[3px] hover:bg-[#767676] hover:text-black"
                >
                  Create Another Badge
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Integration */}
        <div className="col-span-1 xl:col-span-2">
          <TelegramLinks 
            eventSlug={eventSlug} 
            sessionId={badgeData?.id || ''} 
            className="bg-[#111111] border-[#111111]"
          />
        </div>
      </div>
    </ConfirmationTemplate>
  )
}
