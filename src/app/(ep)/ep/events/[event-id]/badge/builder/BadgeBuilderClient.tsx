'use client'

import { useState, useTransition } from 'react'
import DataDrivenBadgePreview from '@/components/events/DataDrivenBadgePreview'
import { DEFAULT_BADGE_TEMPLATE, FONT_OPTIONS } from '@/types/badge-template'
import type { BadgeTemplateConfig } from '@/types/badge-template'
import { saveBadgeTemplate, type PastTemplate } from './actions'

interface Props {
  eventId: string
  existingTemplate: {
    name: string
    config: BadgeTemplateConfig
    backgroundImageUrl: string | null
  } | null
  pastTemplates: PastTemplate[]
}

const GRADIENT_DIRECTIONS = [
  { value: 'to bottom', label: 'Top to Bottom' },
  { value: 'to top', label: 'Bottom to Top' },
  { value: 'to right', label: 'Left to Right' },
  { value: 'to left', label: 'Right to Left' },
  { value: 'to bottom right', label: 'Diagonal (TL to BR)' },
  { value: 'to bottom left', label: 'Diagonal (TR to BL)' },
]

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--sd-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  fontSize: '14px',
  color: 'var(--sd-text)',
  background: 'var(--sd-bg)',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  outline: 'none',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
}

const colorInputStyle: React.CSSProperties = {
  width: '48px',
  height: '36px',
  padding: '2px',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  background: 'var(--sd-bg)',
  cursor: 'pointer',
}

const numberInputStyle: React.CSSProperties = {
  ...inputStyle,
  width: '100px',
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--sd-card)',
  border: '1px solid var(--sd-border)',
  borderRadius: 'var(--sd-radius)',
  padding: '16px 20px',
  marginBottom: '12px',
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: '14px',
  fontWeight: 600,
  color: 'var(--sd-text)',
  marginBottom: '12px',
}

export default function BadgeBuilderClient({
  eventId,
  existingTemplate,
  pastTemplates,
}: Props) {
  const initial = existingTemplate?.config ?? DEFAULT_BADGE_TEMPLATE

  const [name, setName] = useState(existingTemplate?.name ?? '')
  const [width, setWidth] = useState(initial.dimensions.width)
  const [height, setHeight] = useState(initial.dimensions.height)
  const [bgType, setBgType] = useState(initial.background.type)
  const [bgColor, setBgColor] = useState(initial.background.color ?? '#1a1a1a')
  const [gradFrom, setGradFrom] = useState(initial.background.gradientFrom ?? '#0f2733')
  const [gradTo, setGradTo] = useState(initial.background.gradientTo ?? '#170a2a')
  const [gradDirection, setGradDirection] = useState(
    initial.background.gradientDirection ?? 'to bottom',
  )
  const [backgroundImageUrl, setBackgroundImageUrl] = useState<string | null>(
    existingTemplate?.backgroundImageUrl ?? null,
  )
  const [textColor, setTextColor] = useState(initial.textColor)
  const [fontFamily, setFontFamily] = useState(initial.fontFamily)
  const [borderColor, setBorderColor] = useState(initial.border.color)
  const [borderWidth, setBorderWidth] = useState(initial.border.width)
  const [borderRadius, setBorderRadius] = useState(initial.border.radius)
  const [photoShape, setPhotoShape] = useState(initial.photo.shape)
  const [photoSize, setPhotoSize] = useState(initial.photo.size)
  const [photoOffsetY, setPhotoOffsetY] = useState(initial.photo.offsetY)
  const [maxHandles, setMaxHandles] = useState<1 | 2>(initial.socialMedia.maxHandles)

  const [isPending, startTransition] = useTransition()
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error'
    text: string
  } | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)

  const currentConfig: BadgeTemplateConfig = {
    dimensions: { width, height },
    background:
      bgType === 'gradient'
        ? {
            type: 'gradient',
            gradientFrom: gradFrom,
            gradientTo: gradTo,
            gradientDirection: gradDirection,
          }
        : bgType === 'image'
          ? { type: 'image' }
          : { type: 'solid', color: bgColor },
    textColor,
    fontFamily,
    border: { color: borderColor, width: borderWidth, radius: borderRadius },
    photo: { shape: photoShape, size: photoSize, offsetY: photoOffsetY },
    socialMedia: { maxHandles },
  }

  function loadFromPastTemplate(templateId: string) {
    const t = pastTemplates.find((pt) => pt.id === templateId)
    if (!t) return
    const c = t.config
    setName(t.name || '')
    setWidth(c.dimensions.width)
    setHeight(c.dimensions.height)
    setBgType(c.background.type)
    setBgColor(c.background.color ?? '#1a1a1a')
    setGradFrom(c.background.gradientFrom ?? '#0f2733')
    setGradTo(c.background.gradientTo ?? '#170a2a')
    setGradDirection(c.background.gradientDirection ?? 'to bottom')
    setBackgroundImageUrl(t.backgroundImageUrl)
    setTextColor(c.textColor)
    setFontFamily(c.fontFamily)
    setBorderColor(c.border.color)
    setBorderWidth(c.border.width)
    setBorderRadius(c.border.radius)
    setPhotoShape(c.photo.shape)
    setPhotoSize(c.photo.size)
    setPhotoOffsetY(c.photo.offsetY)
    setMaxHandles(c.socialMedia.maxHandles)
    setSaveMessage(null)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', 'badge-template-bg')
      formData.append('badgeName', 'template-background')
      formData.append('email', 'template')
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      if (res.ok) {
        const result = await res.json()
        setBackgroundImageUrl(result.url)
        setBgType('image')
      } else {
        setSaveMessage({ type: 'error', text: 'Image upload failed.' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Image upload failed.' })
    } finally {
      setUploadingImage(false)
    }
  }

  function handleSave() {
    setSaveMessage(null)
    startTransition(async () => {
      const result = await saveBadgeTemplate(
        eventId,
        name,
        currentConfig,
        backgroundImageUrl,
      )
      if (result.success) {
        setSaveMessage({ type: 'success', text: 'Badge template saved.' })
      } else {
        setSaveMessage({ type: 'error', text: result.error || 'Failed to save.' })
      }
    })
  }

  return (
    <div>
      {/* Responsive layout: two columns on desktop, single on mobile */}
      <style>{`
        .badge-builder-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 32px;
        }
        @media (max-width: 768px) {
          .badge-builder-layout {
            grid-template-columns: 1fr !important;
          }
          .badge-builder-preview {
            position: static !important;
            top: auto !important;
          }
        }
      `}</style>

      <div className="badge-builder-layout">
        {/* Controls panel */}
        <div>
          {/* Reuse from past event */}
          {pastTemplates.length > 0 && (
            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>Reuse from Past Event</div>
              <select
                style={selectStyle}
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) loadFromPastTemplate(e.target.value)
                }}
              >
                <option value="">Select a template...</option>
                {pastTemplates.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.name || 'Untitled'} ({pt.eventTitle})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Template Name */}
          <div style={sectionStyle}>
            <label style={labelStyle}>Template Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. COG Classic 2026"
              style={inputStyle}
            />
          </div>

          {/* Dimensions */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Dimensions</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Width (px)</label>
                <input
                  type="number"
                  value={width}
                  min={100}
                  max={800}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Height (px)</label>
                <input
                  type="number"
                  value={height}
                  min={100}
                  max={1000}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Background */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Background</div>
            <div
              style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}
              role="radiogroup"
              aria-label="Background type"
            >
              {(['solid', 'gradient', 'image'] as const).map((type) => (
                <label
                  key={type}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '13px',
                    color: 'var(--sd-text)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="bgType"
                    value={type}
                    checked={bgType === type}
                    onChange={() => setBgType(type)}
                  />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </label>
              ))}
            </div>

            {bgType === 'solid' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={labelStyle}>Color</label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  style={colorInputStyle}
                />
                <input
                  type="text"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  style={{ ...inputStyle, width: '120px' }}
                  maxLength={7}
                />
              </div>
            )}

            {bgType === 'gradient' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div>
                    <label style={labelStyle}>From</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={gradFrom}
                        onChange={(e) => setGradFrom(e.target.value)}
                        style={colorInputStyle}
                      />
                      <input
                        type="text"
                        value={gradFrom}
                        onChange={(e) => setGradFrom(e.target.value)}
                        style={{ ...inputStyle, width: '100px' }}
                        maxLength={7}
                      />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>To</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="color"
                        value={gradTo}
                        onChange={(e) => setGradTo(e.target.value)}
                        style={colorInputStyle}
                      />
                      <input
                        type="text"
                        value={gradTo}
                        onChange={(e) => setGradTo(e.target.value)}
                        style={{ ...inputStyle, width: '100px' }}
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Direction</label>
                  <select
                    value={gradDirection}
                    onChange={(e) => setGradDirection(e.target.value)}
                    style={selectStyle}
                  >
                    {GRADIENT_DIRECTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {bgType === 'image' && (
              <div>
                <label
                  style={{
                    display: 'inline-block',
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#fff',
                    background: 'var(--sd-purple)',
                    border: 'none',
                    borderRadius: 'var(--sd-radius)',
                    cursor: uploadingImage ? 'not-allowed' : 'pointer',
                    opacity: uploadingImage ? 0.6 : 1,
                  }}
                >
                  {uploadingImage ? 'Uploading...' : 'Upload Background Image'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    style={{ display: 'none' }}
                  />
                </label>
                {backgroundImageUrl && (
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--sd-muted)',
                      marginTop: '8px',
                    }}
                  >
                    Background image set.{' '}
                    <button
                      type="button"
                      onClick={() => setBackgroundImageUrl(null)}
                      style={{
                        color: 'var(--sd-purple)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '12px',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      Remove
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Typography */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Typography</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'end' }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Text Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={colorInputStyle}
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    style={{ ...inputStyle, width: '100px' }}
                    maxLength={7}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Font Family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  style={selectStyle}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Border */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Border</div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
              <div>
                <label style={labelStyle}>Color</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    style={colorInputStyle}
                  />
                  <input
                    type="text"
                    value={borderColor}
                    onChange={(e) => setBorderColor(e.target.value)}
                    style={{ ...inputStyle, width: '100px' }}
                    maxLength={7}
                  />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Width (px)</label>
                <input
                  type="number"
                  value={borderWidth}
                  min={0}
                  max={5}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                  style={numberInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Radius (px)</label>
                <input
                  type="number"
                  value={borderRadius}
                  min={0}
                  max={30}
                  onChange={(e) => setBorderRadius(Number(e.target.value))}
                  style={numberInputStyle}
                />
              </div>
            </div>
          </div>

          {/* Photo */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Photo</div>
            <div style={{ marginBottom: '10px' }}>
              <label style={labelStyle}>Shape</label>
              <div
                style={{ display: 'flex', gap: '16px' }}
                role="radiogroup"
                aria-label="Photo shape"
              >
                {(['circle', 'square', 'rounded'] as const).map((shape) => (
                  <label
                    key={shape}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '13px',
                      color: 'var(--sd-text)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="photoShape"
                      value={shape}
                      checked={photoShape === shape}
                      onChange={() => setPhotoShape(shape)}
                    />
                    {shape.charAt(0).toUpperCase() + shape.slice(1)}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Size (px)</label>
                <input
                  type="number"
                  value={photoSize}
                  min={80}
                  max={250}
                  onChange={(e) => setPhotoSize(Number(e.target.value))}
                  style={numberInputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Y Offset (px)</label>
                <input
                  type="number"
                  value={photoOffsetY}
                  min={20}
                  max={200}
                  onChange={(e) => setPhotoOffsetY(Number(e.target.value))}
                  style={numberInputStyle}
                />
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Social Media</div>
            <label style={labelStyle}>Max Handles</label>
            <select
              value={maxHandles}
              onChange={(e) => setMaxHandles(Number(e.target.value) as 1 | 2)}
              style={{ ...selectStyle, width: '100px' }}
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
            </select>
          </div>

          {/* Save message */}
          {saveMessage && (
            <div
              style={{
                padding: '10px 16px',
                marginBottom: '12px',
                borderRadius: 'var(--sd-radius)',
                fontSize: '13px',
                background:
                  saveMessage.type === 'success'
                    ? 'var(--sd-green-light)'
                    : 'var(--sd-red-light, #fef2f2)',
                border: `1px solid ${saveMessage.type === 'success' ? 'var(--sd-green)' : 'var(--sd-red, #ef4444)'}`,
                color:
                  saveMessage.type === 'success'
                    ? 'var(--sd-green-dark)'
                    : 'var(--sd-red, #ef4444)',
              }}
            >
              {saveMessage.text}
            </div>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: '14px',
              fontWeight: 600,
              color: '#fff',
              background: isPending ? 'var(--sd-muted)' : 'var(--sd-purple)',
              border: 'none',
              borderRadius: 'var(--sd-radius)',
              cursor: isPending ? 'not-allowed' : 'pointer',
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? 'Saving...' : 'Save Template'}
          </button>
        </div>

        {/* Live preview panel */}
        <div
          className="badge-builder-preview"
          style={{
            position: 'sticky',
            top: '2rem',
            alignSelf: 'start',
          }}
        >
          <div
            style={{
              background: 'var(--sd-card)',
              border: '1px solid var(--sd-border)',
              borderRadius: 'var(--sd-radius)',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <p
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--sd-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: '16px',
              }}
            >
              Live Preview
            </p>
            <DataDrivenBadgePreview
              config={currentConfig}
              backgroundImageUrl={backgroundImageUrl}
              badgeData={{
                badge_name: 'Sample Name',
                social_media_handles: [
                  { platform: 'x', handle: '@samplehandle' },
                  { platform: 'discord', handle: 'SampleUser' },
                ],
              }}
            />
            <p
              style={{
                color: 'var(--sd-muted)',
                fontSize: '11px',
                textAlign: 'center',
                maxWidth: '260px',
                marginTop: '12px',
              }}
            >
              *Simulated layout with sample data. Actual badges will use attendee data.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
