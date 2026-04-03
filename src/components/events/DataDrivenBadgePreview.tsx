'use client'

import { useMemo } from 'react'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { getPlatformIcon } from '@/lib/badge-assets'
import type { BadgeTemplateConfig } from '@/types/badge-template'
import type { SocialMediaHandle } from '@/types/badge'

interface DataDrivenBadgePreviewProps {
  config: BadgeTemplateConfig
  backgroundImageUrl?: string | null
  badgeData?: { badge_name?: string; social_media_handles?: SocialMediaHandle[] }
  imageUrl?: string
}

const FALLBACK_ICON = '/assets/b781d68fabc1456063513abebee66dde467f5846.svg'

function getPhotoRadius(shape: 'circle' | 'square' | 'rounded'): string {
  switch (shape) {
    case 'circle':
      return '50%'
    case 'rounded':
      return '8px'
    case 'square':
      return '0'
  }
}

function getBackgroundStyle(
  bg: BadgeTemplateConfig['background'],
  backgroundImageUrl?: string | null,
): React.CSSProperties {
  if (bg.type === 'image' && backgroundImageUrl) {
    return {
      backgroundImage: `url(${backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  }
  if (bg.type === 'gradient' && bg.gradientFrom && bg.gradientTo) {
    return {
      background: `linear-gradient(${bg.gradientDirection || 'to bottom'}, ${bg.gradientFrom}, ${bg.gradientTo})`,
    }
  }
  return {
    backgroundColor: bg.color || '#1a1a1a',
  }
}

export default function DataDrivenBadgePreview({
  config,
  backgroundImageUrl,
  badgeData,
  imageUrl,
}: DataDrivenBadgePreviewProps) {
  const { data: storeData, originalImage, croppedImage } = useBadgeStore()

  const displayData = badgeData || storeData
  const storeImage = croppedImage || originalImage

  const objectUrl = useMemo(() => {
    if (imageUrl || badgeData) return null
    if (storeImage) return URL.createObjectURL(storeImage)
    return null
  }, [imageUrl, badgeData, storeImage])

  const resolvedImageUrl = imageUrl || objectUrl || null

  const photoRadius = getPhotoRadius(config.photo.shape)
  const bgStyle = getBackgroundStyle(config.background, backgroundImageUrl)

  const handles = (displayData.social_media_handles ?? [])
    .filter(
      (h: SocialMediaHandle) =>
        h.platform && h.platform !== 'none' && h.handle && h.handle.trim().length > 0,
    )
    .slice(0, config.socialMedia.maxHandles)

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {/* Badge card */}
      <div
        style={{
          width: `${config.dimensions.width}px`,
          height: `${config.dimensions.height}px`,
          ...bgStyle,
          border: `${config.border.width}px solid ${config.border.color}`,
          borderRadius: `${config.border.radius}px`,
          boxSizing: 'border-box',
          padding: '15px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden',
          position: 'relative',
          fontFamily: `'${config.fontFamily}', sans-serif`,
        }}
      >
        {/* Photo */}
        <div
          style={{
            marginTop: `${config.photo.offsetY}px`,
            width: `${config.photo.size}px`,
            height: `${config.photo.size}px`,
            borderRadius: photoRadius,
            backgroundColor: '#d9d9d9',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {resolvedImageUrl ? (
            <img
              src={resolvedImageUrl}
              alt="Profile"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: photoRadius,
              }}
            />
          ) : (
            <img
              src="/assets/question-placer@2x.png"
              alt="Placeholder"
              style={{ width: '32px', height: '32px', objectFit: 'contain' }}
            />
          )}
        </div>

        {/* Name */}
        <div
          style={{
            marginTop: '12px',
            padding: '0 10px',
            width: '100%',
            textAlign: 'center',
            flexShrink: 0,
          }}
        >
          <p
            style={{
              color: config.textColor,
              fontSize: `${Math.max(14, Math.round(config.dimensions.width / 12))}px`,
              lineHeight: 1.2,
              margin: 0,
              wordBreak: 'break-word',
              fontWeight: 400,
            }}
          >
            {displayData.badge_name || 'BADGE NAME'}
          </p>
        </div>

        {/* Social handles */}
        {handles.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '0 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}
          >
            {handles.map((h: SocialMediaHandle, i: number) => {
              // Platform is guaranteed to not be 'none' by the filter above
              const iconSrc = getPlatformIcon(h.platform as Parameters<typeof getPlatformIcon>[0]) || FALLBACK_ICON
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    paddingLeft: '10px',
                  }}
                >
                  <img
                    src={iconSrc}
                    alt={`${h.platform} icon`}
                    style={{ width: '20px', height: '22px', flexShrink: 0 }}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = FALLBACK_ICON
                    }}
                  />
                  <span
                    style={{
                      color: config.textColor,
                      fontSize: '14px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {h.handle}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
