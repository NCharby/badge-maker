'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ConfirmationTemplate } from '@/components/templates/ConfirmationTemplate'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card'
import { Button } from '@/components/atoms/button'
import { TelegramLinks } from '@/components/molecules/TelegramLinks'
import { BadgePreview } from '@/components/organisms/BadgePreview'
import { SocialMediaHandle } from '@/types/badge'
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
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

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

  // Send confirmation email when badge data is loaded and telegram is ready
  useEffect(() => {
    const sendConfirmationEmail = async () => {
      
      if (!badgeData?.id || !eventSlug || emailStatus !== 'idle') {
        return;
      }
      
      try {
        setEmailStatus('sending');
        
        // Wait a moment for telegram bot to potentially generate invite
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        
        const requestData = {
          type: 'badge-confirmation',
          data: { badgeId: badgeData.id, eventSlug }
        };
        
        
        const response = await fetch('/api/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData)
        });
        
        
        if (response.ok) {
          const responseData = await response.json();
          setEmailStatus('sent');
        } else {
          const errorData = await response.json();
          console.error('Email sending failed:', errorData);
          setEmailStatus('failed');
        }
      } catch (error) {
        console.error('Error sending confirmation email:', error);
        setEmailStatus('failed');
      }
    };
    
    sendConfirmationEmail();
  }, [badgeData?.id, eventSlug, emailStatus])

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
        <div className="flex flex-col items-center justify-center min-h-[600px]">
          <BadgePreview 
            badgeData={badgeData ? {
              badge_name: badgeData.badge_name,
              social_media_handles: badgeData.social_media_handles as SocialMediaHandle[]
            } : undefined}
            imageUrl={imageUrl || undefined}
          />
          <p className="text-[#949494] font-open-sans text-[12px] text-center max-w-[300px] mt-0 sm:mt-0 md:mt-[45px] lg:mt-[45px]">
            *Simulated layout. Your actual badge will be printed slightly differently.
          </p>
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
                              {handle.handle}
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
                    Join us on Telegram to stay updated with the latest news and events.
                  </p>
                </div>
              </>
            )}

            {/* Email Status Display */}
            <div className="border-t border-[#5c5c5c] pt-4">
              <div className="text-center space-y-2">
                {emailStatus === 'sending' && (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <p className="text-[#949494] font-open-sans text-[14px]">
                      Preparing confirmation email...
                    </p>
                  </div>
                )}
                {emailStatus === 'sent' && (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 bg-green-400 rounded-full flex items-center justify-center">
                      <span className="text-black text-xs">✓</span>
                    </div>
                    <p className="text-green-400 font-open-sans text-[14px]">
                      Confirmation email sent successfully!
                    </p>
                  </div>
                )}
                {emailStatus === 'failed' && (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 bg-red-400 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">!</span>
                    </div>
                    <p className="text-red-400 font-open-sans text-[14px]">
                      Failed to send confirmation email. Please contact support.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Telegram Integration */}
            <div className="border-t border-[#5c5c5c] pt-4">
              <TelegramLinks 
                eventSlug={eventSlug} 
                sessionId={badgeData?.id || ''} 
                className="bg-transparent border-none shadow-none"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </ConfirmationTemplate>
  )
}
