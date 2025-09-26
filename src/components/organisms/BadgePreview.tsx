'use client'

import { useBadgeStore } from '@/hooks/useBadgeStore'
import { getPlatformIcon, getPlatformDisplayName } from '@/lib/badge-assets'
import { SocialMediaHandle } from '@/types/badge'

interface BadgePreviewProps {
  badgeData?: {
    badge_name?: string
    social_media_handles?: SocialMediaHandle[]
  }
  imageUrl?: string
}

// Figma-generated asset paths
const imgFrillLeft = "/assets/8f843d894bd14f810d7e08a72c13f91ad17c5f48.svg";
const imgFrillRight = "/assets/58d534b6b91424b0cf56bd425669df37da35f4d9.svg";
const imgGroup1 = "/assets/2c6cb173ab669ace01ece5b59fa70abcc55efcec.svg";
const imgVector = "/assets/b781d68fabc1456063513abebee66dde467f5846.svg";
const imgVector1 = "/assets/1efc31fed812b9e092a380850264248ce3a30d63.svg";

/**
 * BadgePreview Component - Exact Figma Design Implementation
 * 
 * This component renders the exact badge design from Figma specifications.
 * It uses the precise dimensions, colors, typography, and layout from the design.
 * 
 * Figma Design Specifications:
 * - Dark gradient background (from #170a2a to #0f2733)
 * - 284x400px dimensions with 10px border radius
 * - Montserrat font family
 * - White text on dark background
 * - Compact vertical layout with specific spacing
 * - Maximum 2 social media handles with visual icons
 */
export function BadgePreview({ badgeData, imageUrl }: BadgePreviewProps = {}) {
  const { data, originalImage, croppedImage } = useBadgeStore()

  // Use props data if provided, otherwise fall back to store data
  const displayData = badgeData || data
  const displayImage = imageUrl ? null : (croppedImage || originalImage)

  return (
    <div className="flex justify-center items-center min-h-[600px] sm:min-h-[500px] md:min-h-[600px]">
      {/* Badge Container - Responsive scaling while maintaining aspect ratio */}
      <div 
        className="bg-gradient-to-b box-border content-stretch flex from-[#0f2733] from-[0.214%] gap-2.5 items-center justify-start p-[15px] relative size-full to-[#170a2a] to-[99.748%] rounded-[10px]
                   w-[284px] h-[400px] scale-100
                   sm:w-[320px] sm:h-[450px] sm:scale-110
                   md:w-[355px] md:h-[500px] md:scale-125
                   lg:w-[390px] lg:h-[550px] lg:scale-140"
        data-name="Badge"
      >
        <div 
          className="basis-0 grow h-full min-h-px min-w-px relative rounded-[10px] shrink-0"
          data-name="Window"
        >
          <div className="box-border content-stretch flex flex-col items-start justify-start overflow-clip p-[10px] relative size-full">
            {/* Top Decoration - Frill elements */}
            <div 
              className="box-border content-stretch flex items-start justify-between overflow-clip p-[5px] relative shrink-0 w-full"
              data-name="top decoration"
            >
              <div 
                className="h-[23.477px] relative shrink-0 w-[84.422px]"
                data-name="frill left"
              >
                <img alt="" className="block max-w-none size-full" src={imgFrillLeft} />
              </div>
              <div 
                className="h-[23.477px] relative shrink-0 w-[100px]"
                data-name="frill right"
              >
                <img alt="" className="block max-w-none size-full" src={imgFrillRight} />
              </div>
            </div>

            {/* Image Wrapper - Photo section */}
            <div 
              className="content-stretch flex gap-2.5 items-center justify-center overflow-clip relative shrink-0 w-full"
              data-name="Image Wrapper"
            >
              <div 
                className="bg-[#d9d9d9] shrink-0 
                           size-[145px] rounded-[80px]
                           sm:size-[160px] sm:rounded-[90px]
                           md:size-[180px] md:rounded-[100px]
                           lg:size-[200px] lg:rounded-[110px]
                           flex items-center justify-center"
                data-name="Badge Image"
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Profile"
                    className="w-full h-full object-cover 
                               rounded-[80px]
                               sm:rounded-[90px]
                               md:rounded-[100px]
                               lg:rounded-[110px]"
                  />
                ) : displayImage ? (
                  <img
                    src={URL.createObjectURL(displayImage)}
                    alt="Profile"
                    className="w-full h-full object-cover 
                               rounded-[80px]
                               sm:rounded-[90px]
                               md:rounded-[100px]
                               lg:rounded-[110px]"
                  />
                ) : (
                  <img
                    src="/assets/question-placer@2x.png"
                    alt="Question mark placeholder"
                    className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-12 lg:h-12 object-contain"
                  />
                )}
              </div>
            </div>

            {/* Name Wrapper - Badge name */}
            <div 
              className="box-border content-stretch flex flex-col gap-2.5 items-center justify-start overflow-clip p-[10px] relative shrink-0 w-full"
              data-name="Name Wrapper"
            >
              <div 
                className="font-['Montserrat:Regular',_sans-serif] leading-[0] not-italic relative shrink-0 
                           text-[24px] 
                           sm:text-[26px] 
                           md:text-[28px] 
                           lg:text-[30px] 
                           text-white text-center"
              >
                <p className="leading-[17px] sm:leading-[18px] md:leading-[19px] lg:leading-[20px] break-words">
                  {displayData.badge_name || 'BADGE NAME'}
                </p>
              </div>
            </div>

            {/* Lower Decoration */}
            <div 
              className="content-stretch flex flex-col gap-2.5 items-center justify-start overflow-clip relative shrink-0 w-full"
              data-name="lower decoration"
            >
              <div className="h-[57.019px] relative shrink-0 w-[173.873px]">
                <img alt="" className="block max-w-none size-full" src={imgGroup1} />
              </div>
            </div>

            {/* Social Media Handles - Limited to 2 */}
            {/* Social Handle 1 */}
            {displayData.social_media_handles?.[0]?.platform && displayData.social_media_handles[0].platform !== 'none' && (
              <div 
                className="box-border content-stretch flex gap-2.5 items-center justify-start overflow-clip px-5 py-1 relative shrink-0 w-full"
                data-name="Social 1"
              >
                <div 
                  className="h-7 w-6 sm:h-8 sm:w-7 md:h-9 md:w-8 lg:h-10 lg:w-9 relative shrink-0"
                  data-name="Vector"
                >
                  {getPlatformIcon(displayData.social_media_handles[0].platform) ? (
                    <img 
                      src={getPlatformIcon(displayData.social_media_handles[0].platform)!}
                      alt={`${displayData.social_media_handles[0].platform} icon`}
                      className="block max-w-none size-full"
                      onError={(e) => {
                        // Fallback to default icon if platform icon fails to load
                        const target = e.target as HTMLImageElement;
                        target.src = imgVector;
                      }}
                    />
                  ) : (
                    <img alt="" className="block max-w-none size-full" src={imgVector} />
                  )}
                </div>
                <div 
                  className="font-['Montserrat:Regular',_sans-serif] leading-[0] not-italic relative shrink-0 
                             text-[16px] 
                             sm:text-[17px] 
                             md:text-[18px] 
                             lg:text-[19px] 
                             text-nowrap text-white"
                >
                  <p className="leading-[17px] sm:leading-[18px] md:leading-[19px] lg:leading-[20px] whitespace-pre">
                    {displayData.social_media_handles?.[0]?.handle || '@social_handle1'}
                  </p>
                </div>
              </div>
            )}

            {/* Social Handle 2 */}
            {displayData.social_media_handles?.[1]?.platform && displayData.social_media_handles[1].platform !== 'none' && (
              <div 
                className="box-border content-stretch flex gap-2.5 items-center justify-start overflow-clip px-5 py-[5px] relative shrink-0 w-full"
                data-name="Social 2"
              >
                <div 
                  className="h-7 w-6 sm:h-8 sm:w-7 md:h-9 md:w-8 lg:h-10 lg:w-9 relative shrink-0"
                  data-name="Vector"
                >
                  {getPlatformIcon(displayData.social_media_handles[1].platform) ? (
                    <img 
                      src={getPlatformIcon(displayData.social_media_handles[1].platform)!}
                      alt={`${displayData.social_media_handles[1].platform} icon`}
                      className="block max-w-none size-full"
                      onError={(e) => {
                        // Fallback to default icon if platform icon fails to load
                        const target = e.target as HTMLImageElement;
                        target.src = imgVector1;
                      }}
                    />
                  ) : (
                    <img alt="" className="block max-w-none size-full" src={imgVector1} />
                  )}
                </div>
                <div 
                  className="font-['Montserrat:Regular',_sans-serif] leading-[0] not-italic relative shrink-0 
                             text-[16px] 
                             sm:text-[17px] 
                             md:text-[18px] 
                             lg:text-[19px] 
                             text-nowrap text-white"
                >
                  <p className="leading-[17px] sm:leading-[18px] md:leading-[19px] lg:leading-[20px] whitespace-pre">
                    {displayData.social_media_handles?.[1]?.handle || '@social_handle2'}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div 
            aria-hidden="true" 
            className="absolute border border-[#cccc64] border-solid inset-0 pointer-events-none rounded-[10px]" 
          />
        </div>
      </div>
    </div>
  )
}
