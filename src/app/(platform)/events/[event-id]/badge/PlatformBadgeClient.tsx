'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { getEventBadgeComponent } from '@/components/events'
import { ImageUpload } from '@/components/molecules/ImageUpload'
import { SocialMediaInput } from '@/components/molecules/SocialMediaInput'
import { createPlatformBadge } from './actions'
import type { SocialMediaHandle } from '@/types/badge'
import type { BadgeTemplateConfig } from '@/types/badge-template'

const socialMediaPlatforms = [
  { value: 'none', label: 'None' },
  { value: 'x', label: 'X (Twitter)' },
  { value: 'bluesky', label: 'BlueSky' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'recon', label: 'Recon' },
  { value: 'furaffinity', label: 'FurAffinity' },
  { value: 'fetlife', label: 'FetLife' },
  { value: 'discord', label: 'Discord' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'other', label: 'Other' },
]

interface PlatformBadgeClientProps {
  eventId: string
  eventSlug: string
  eventTitle: string
  defaultBadgeName: string
  defaultEmail: string
  defaultSocialMedia: { platform: string; handle: string }[]
  badgeTemplateConfig?: BadgeTemplateConfig | null
  backgroundImageUrl?: string | null
}

export default function PlatformBadgeClient({
  eventId,
  eventSlug,
  eventTitle,
  defaultBadgeName,
  defaultEmail,
  defaultSocialMedia,
  badgeTemplateConfig,
  backgroundImageUrl,
}: PlatformBadgeClientProps) {
  const [badgeName, setBadgeName] = useState(defaultBadgeName)
  const [socialHandles, setSocialHandles] = useState<SocialMediaHandle[]>(
    defaultSocialMedia.length > 0
      ? defaultSocialMedia.slice(0, 2).map(s => ({
          platform: (s.platform || 'none') as SocialMediaHandle['platform'],
          handle: s.handle || '',
        }))
      : []
  )
  const [imageError, setImageError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  const { data, setData, originalImage, croppedImage, reset } = useBadgeStore()

  // Get badge preview component: data-driven if template exists, else slug-based
  const EventBadgePreview = getEventBadgeComponent(eventSlug, badgeTemplateConfig, backgroundImageUrl)

  // Reset store on mount to clear stale state, then seed with defaults
  useEffect(() => {
    reset()
    setData({
      badge_name: defaultBadgeName,
      email: defaultEmail,
      social_media_handles: defaultSocialMedia.slice(0, 2).map(s => ({
        platform: (s.platform || 'none') as SocialMediaHandle['platform'],
        handle: s.handle || '',
      })),
    })
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync badge name to store for live preview
  const handleBadgeNameChange = useCallback((value: string) => {
    setBadgeName(value)
    setData({ badge_name: value })
  }, [setData])

  // Sync social handles to store for live preview
  const handleSocialChange = useCallback((handles: SocialMediaHandle[]) => {
    setSocialHandles(handles)
    setData({ social_media_handles: handles })
  }, [setData])

  // Clear image error when image is uploaded
  useEffect(() => {
    if (originalImage && imageError) {
      setImageError(null)
    }
  }, [originalImage, imageError])

  const uploadImage = async (file: File | Blob, type: string): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)
      formData.append('badgeName', badgeName)
      formData.append('email', defaultEmail)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        return result.url
      }
      console.warn(`${type} image upload failed`)
      return null
    } catch (err) {
      console.warn(`${type} image upload error:`, err)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)
    setImageError(null)

    // Validate badge name
    const trimmedName = badgeName.trim()
    if (!trimmedName) {
      setSubmitError('Badge name is required.')
      return
    }
    if (trimmedName.length > 40) {
      setSubmitError('Badge name must be 40 characters or less.')
      return
    }

    // Validate image
    const storeState = useBadgeStore.getState()
    if (!storeState.originalImage && !storeState.croppedImage) {
      setImageError('Badge photo is required. Please upload an image.')
      return
    }

    startTransition(async () => {
      try {
        // Upload images
        let originalImageUrl: string | null = null
        let croppedImageUrl: string | null = null

        if (storeState.originalImage) {
          originalImageUrl = await uploadImage(storeState.originalImage, 'original')
        }
        if (storeState.croppedImage) {
          croppedImageUrl = await uploadImage(storeState.croppedImage, 'cropped')
        }

        if (!originalImageUrl && !croppedImageUrl) {
          setSubmitError('Image upload failed. Please try again.')
          return
        }

        // Filter valid social handles
        const validHandles = socialHandles.filter(
          h => h.platform && h.platform !== 'none' && h.handle.trim().length > 0
        )

        const result = await createPlatformBadge(eventId, {
          badgeName: trimmedName,
          socialMediaHandles: validHandles,
          originalImageUrl,
          croppedImageUrl,
          cropData: storeState.cropData ? { ...storeState.cropData } : null,
        })

        if (result.success) {
          router.refresh()
          return
        } else {
          setSubmitError(result.error || 'Failed to create badge.')
        }
      } catch {
        setSubmitError('An unexpected error occurred. Please try again.')
      }
    })
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: '32px',
        maxWidth: '1200px',
        margin: '0 auto',
      }}
      className="badge-layout"
    >
      {/* Responsive override: single column on small screens */}
      <style>{`
        @media (max-width: 768px) {
          .badge-layout {
            grid-template-columns: 1fr !important;
          }
          .badge-preview-sticky {
            position: static !important;
            top: auto !important;
          }
        }
      `}</style>
      {/* Form Section */}
      <form onSubmit={handleSubmit}>
        {/* Email (read-only) */}
        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--sd-muted)',
              marginBottom: '6px',
            }}
          >
            Email
          </label>
          <p style={{ fontSize: '14px', color: 'var(--sd-text)' }}>{defaultEmail}</p>
        </div>

        {/* Badge Name */}
        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '6px',
            }}
          >
            <label
              style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sd-text)' }}
            >
              Badge Name *
            </label>
            <span style={{ fontSize: '12px', color: 'var(--sd-muted)' }}>
              {badgeName.length}/40
            </span>
          </div>
          <input
            type="text"
            value={badgeName}
            onChange={e => handleBadgeNameChange(e.target.value)}
            maxLength={40}
            placeholder="Your badge name"
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '14px',
              color: 'var(--sd-text)',
              background: 'var(--sd-bg)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Social Media */}
        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--sd-text)',
              marginBottom: '12px',
            }}
          >
            Social Media (Optional, max 2)
          </label>
          <SocialMediaInput
            platforms={socialMediaPlatforms}
            value={socialHandles}
            onChange={handleSocialChange}
          />
        </div>

        {/* Photo Upload */}
        <div
          style={{
            background: 'var(--sd-card)',
            border: '1px solid var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '20px',
            marginBottom: '16px',
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--sd-text)',
              marginBottom: '4px',
            }}
          >
            Photo *
          </label>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--sd-muted)',
              marginBottom: '12px',
            }}
          >
            Max 5MB. PNG, JPG, WebP, or GIF. Please refrain from using explicit imagery.
          </p>
          <ImageUpload />
          {imageError && (
            <p
              style={{
                color: 'var(--sd-red)',
                fontSize: '13px',
                marginTop: '8px',
              }}
            >
              {imageError}
            </p>
          )}
        </div>

        {/* Error display */}
        {submitError && (
          <div
            style={{
              background: 'var(--sd-red-light)',
              border: '1px solid var(--sd-red)',
              borderRadius: 'var(--sd-radius)',
              padding: '12px 16px',
              marginBottom: '16px',
              fontSize: '13px',
              color: 'var(--sd-red)',
            }}
          >
            {submitError}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={() => {
              reset()
              setBadgeName(defaultBadgeName)
              setSocialHandles(
                defaultSocialMedia.slice(0, 2).map(s => ({
                  platform: (s.platform || 'none') as SocialMediaHandle['platform'],
                  handle: s.handle || '',
                }))
              )
              setData({
                badge_name: defaultBadgeName,
                email: defaultEmail,
                social_media_handles: defaultSocialMedia.slice(0, 2).map(s => ({
                  platform: (s.platform || 'none') as SocialMediaHandle['platform'],
                  handle: s.handle || '',
                })),
              })
              setSubmitError(null)
              setImageError(null)
            }}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--sd-text)',
              background: 'transparent',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={isPending}
            style={{
              flex: 1,
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              background: isPending ? 'var(--sd-muted)' : 'var(--sd-green)',
              border: 'none',
              borderRadius: 'var(--sd-radius)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Creating Badge...' : 'Create Badge'}
          </button>
        </div>
      </form>

      {/* Live Preview */}
      <div
        className="badge-preview-sticky"
        style={{
          position: 'sticky',
          top: '2rem',
          alignSelf: 'start',
        }}
      >
        <div
          style={{
            width: '100%',
            aspectRatio: '284 / 400',
            maxWidth: '340px',
            margin: '0 auto',
            overflow: 'hidden',
            borderRadius: 'var(--sd-radius)',
          }}
        >
          {/* Scale badge to fit container — transform origin top-center */}
          <div style={{
            transform: 'scale(0.75)',
            transformOrigin: 'top center',
            display: 'flex',
            justifyContent: 'center',
          }}>
            <EventBadgePreview />
          </div>
        </div>
        <p
          style={{
            color: 'var(--sd-muted)',
            fontSize: '12px',
            textAlign: 'center',
            maxWidth: '300px',
            marginTop: '16px',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          *Simulated layout. Your actual badge will be printed slightly differently.
        </p>
      </div>
    </div>
  )
}
