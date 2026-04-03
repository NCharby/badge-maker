'use client'

import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { Plus, X } from 'lucide-react'
import { SocialMediaHandle } from '@/types/badge'

interface SocialMediaInputProps {
  platforms: { value: string; label: string }[]
  value: SocialMediaHandle[]
  onChange: (handles: SocialMediaHandle[]) => void
  error?: string
}

export function SocialMediaInput({ platforms, value, onChange, error }: SocialMediaInputProps) {
  const addHandle = () => {
    if (value.length < 2) {
      onChange([...value, { platform: 'none' as const, handle: '' }])
    }
  }

  const removeHandle = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  const updateHandle = (index: number, field: keyof SocialMediaHandle, newValue: string) => {
    const updatedHandles = [...value]
    updatedHandles[index] = { ...updatedHandles[index], [field]: newValue }
    onChange(updatedHandles)
  }

  return (
    <div className="space-y-3">
      {[0, 1].map((index) => {
        const handle = value[index] || { platform: 'none' as const, handle: '' }
        const isActive = index < value.length

        return (
          <div key={index} className="space-y-[5px]">
            <div className="flex justify-between items-center">
              <Label
                className="text-[16px] font-normal font-montserrat"
                style={{ color: 'var(--sd-text)' }}
              >
                Social {index + 1} (Optional)
              </Label>
              <span
                className="text-[14px] font-montserrat"
                style={{ color: 'var(--sd-muted)' }}
              >
                {handle.handle.length}/85
              </span>
            </div>
            <div className="flex space-x-2">
              <Input
                placeholder="@ThunderBeef"
                value={handle.handle}
                onChange={(e) => {
                  if (isActive) {
                    updateHandle(index, 'handle', e.target.value)
                  } else {
                    const newHandles = [...value, { platform: 'none' as const, handle: e.target.value }]
                    onChange(newHandles)
                  }
                }}
                className="flex-1 h-[41px] rounded-[3px] font-open-sans text-[16px]"
                style={{
                  color: 'var(--sd-text)',
                  background: 'var(--sd-bg)',
                  borderColor: 'var(--sd-border)',
                }}
              />

              {isActive && handle.platform !== 'none' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHandle(index)}
                  className="px-3 h-[41px] flex items-center justify-center"
                  style={{
                    color: 'var(--sd-muted)',
                    borderColor: 'var(--sd-border)',
                    border: '1px solid var(--sd-border)',
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}

              <Select
                value={handle.platform}
                onValueChange={(newValue) => {
                  if (isActive) {
                    updateHandle(index, 'platform', newValue)
                  } else {
                    const newHandles = [...value, { platform: newValue as SocialMediaHandle['platform'], handle: '' }]
                    onChange(newHandles)
                  }
                }}
              >
                <SelectTrigger
                  className="w-[140px] h-[41px] rounded-[3px] font-open-sans text-[16px]"
                  style={{
                    color: 'var(--sd-text)',
                    background: 'var(--sd-card2)',
                    borderColor: 'var(--sd-border)',
                  }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent
                  style={{
                    background: 'var(--sd-card)',
                    borderColor: 'var(--sd-border)',
                    color: 'var(--sd-text)',
                  }}
                >
                  {platforms.map((platform) => (
                    <SelectItem
                      key={platform.value}
                      value={platform.value}
                      style={{ color: 'var(--sd-text)' }}
                    >
                      {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      })}

      {error && (
        <p className="text-sm" style={{ color: 'var(--sd-red)' }}>{error}</p>
      )}
    </div>
  )
}
