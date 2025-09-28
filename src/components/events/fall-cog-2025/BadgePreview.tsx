'use client'

import { SocialMediaHandle } from '@/types/badge'

interface FallBadgePreviewProps {
  badgeData?: {
    badge_name: string;
    social_media_handles: SocialMediaHandle[];
  };
  imageUrl?: string;
}

export function BadgePreview({ badgeData, imageUrl }: FallBadgePreviewProps) {
  // Asset paths for Fall COG 2025 design
  const imgWolfGlyph = "/assets/wolf-glyph.png";
  const imgVector = "/assets/b781d68fabc1456063513abebee66dde467f5846.svg";
  const imgVector1 = "/assets/1efc31fed812b9e092a380850264248ce3a30d63.svg";

  // Get platform icon URL
  const getPlatformIcon = (platform: string) => {
    const iconMap: Record<string, string> = {
      'x': '/assets/social-icons/x-icon-white.svg',
      'bluesky': '/assets/social-icons/bluesky-icon-white.svg',
      'telegram': '/assets/social-icons/telegram-icon-white.svg',
      'recon': '/assets/social-icons/recon-icon-color.svg',
      'furaffinity': '/assets/social-icons/furaffinity-icon-white.svg',
      'fetlife': '/assets/social-icons/fetlife-icon-white.svg',
      'discord': '/assets/social-icons/discord-icon-white.svg',
      'instagram': '/assets/social-icons/instagram-icon-white.svg',
      'other': '/assets/social-icons/telegram-icon-white.svg' // fallback
    };
    return iconMap[platform] || iconMap['other'];
  };

  // Default values
  const badgeName = badgeData?.badge_name || 'BADGE NAME';
  const socialHandles = badgeData?.social_media_handles || [];
  
  // Get first two social handles (max 2 for this design)
  const handle1 = socialHandles[0];
  const handle2 = socialHandles[1];

  return (
    <div className="flex justify-center items-center min-h-[600px] sm:min-h-[500px] md:min-h-[600px]">
      <div 
        className="bg-gradient-to-t box-border content-stretch flex from-[#000000] from-[0.152%] gap-[10px] items-center p-[15px] relative size-full to-[#6d0505] to-[99.848%] rounded-[10px] w-[284px] h-[400px] scale-100 sm:w-[320px] sm:h-[450px] sm:scale-110 md:w-[355px] md:h-[500px] md:scale-125 lg:w-[390px] lg:h-[550px] lg:scale-140" 
        data-name="Badge"
      >
        <div className="basis-0 content-stretch flex flex-col grow h-full items-start min-h-px min-w-px overflow-clip relative rounded-[10px] shrink-0" data-name="Window">
          
          {/* Image Wrapper */}
          <div className="box-border content-stretch flex items-start justify-between p-[10px] relative shrink-0 w-full" data-name="Image Wrapper">
            
            {/* Badge Number */}
            <div className="flex flex-col font-['Montserrat:SemiBold',_sans-serif] justify-center leading-[0] not-italic relative shrink-0 text-[32px] text-nowrap text-white">
              <p className="leading-[19px] whitespace-pre">#xxx</p>
            </div>
            
            {/* Badge Image */}
            <div className="bg-[#d9d9d9] relative rounded-[120px] shrink-0 size-[236px] flex items-center justify-center" data-name="Badge Image">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt="Badge photo" 
                  className="w-full h-full object-cover rounded-[120px]"
                />
              ) : (
                <img 
                  src="/assets/question-placer@2x.png" 
                  alt="Question mark placeholder" 
                  className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 lg:w-12 lg:w-12 object-contain"
                />
              )}
              <div aria-hidden="true" className="absolute border-4 border-solid border-white inset-[-2px] pointer-events-none rounded-[120px]" />
            </div>
            
            {/* Wolf Glyph */}
            <div className="absolute h-[180px] left-[14px] top-[150px]" data-name="Wolf_Glyph">
              <img alt="Wolf glyph decoration" className="block max-w-none size-full" src={imgWolfGlyph} />
            </div>
          </div>
          
          {/* Name Wrapper */}
          <div className="box-border content-stretch flex flex-col items-start overflow-clip p-[10px] relative shrink-0 w-full my-2" data-name="Name Wrapper">
            <div className="flex flex-col font-['Montserrat:Bold',_sans-serif] justify-center leading-[28px] not-italic relative shrink-0 text-[38px] text-white w-full">
              <p className="leading-[32px] font-bold break-words text-center">{badgeName}</p>
            </div>
          </div>
          
          {/* Social Media Handles */}
          {handle1 && handle1.platform !== 'none' && (
            <div className="box-border content-stretch flex gap-[10px] items-center overflow-clip px-[10px] py-4 relative shrink-0 w-full" data-name="Social 1">
              <div className="h-[28px] relative shrink-0 w-[24px]" data-name="Vector">
                <img alt={`${handle1.platform} icon`} className="block max-w-none size-full" src={getPlatformIcon(handle1.platform)} />
              </div>
              <div className="font-['Montserrat:Regular',_sans-serif] leading-[0] not-italic relative shrink-0 text-[22px] text-nowrap text-white">
                <p className="leading-[17px] whitespace-pre">{handle1.handle}</p>
              </div>
            </div>
          )}
          
          {handle2 && handle2.platform !== 'none' && (
            <div className="box-border content-stretch flex gap-[10px] items-center overflow-clip px-[10px] py-[5px] relative shrink-0 w-full" data-name="Social 2">
              <div className="h-[28px] relative shrink-0 w-[24px]" data-name="Vector">
                <img alt={`${handle2.platform} icon`} className="block max-w-none size-full" src={getPlatformIcon(handle2.platform)} />
              </div>
              <div className="font-['Montserrat:Regular',_sans-serif] leading-[0] not-italic relative shrink-0 text-[22px] text-nowrap text-white">
                <p className="leading-[17px] whitespace-pre">{handle2.handle}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
