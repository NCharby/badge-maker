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
    if (value.length < 3) {
      onChange([...value, { platform: 'x', handle: '' }])
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
      {[0, 1, 2].map((index) => {
        const handle = value[index] || { platform: 'x', handle: '' }
        const isActive = index < value.length
        
        return (
          <div key={index} className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-sm font-medium">
                Social {index + 1} (Optional)
              </Label>
              <span className="text-xs text-muted-foreground">
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
                    // Add new handle if this slot is empty
                    const newHandles = [...value, { platform: 'x', handle: e.target.value }]
                    onChange(newHandles)
                  }
                }}
                className="flex-1"
              />
              
              {isActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHandle(index)}
                  className="px-2"
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
                    // Add new handle if this slot is empty
                    const newHandles = [...value, { platform: newValue, handle: '' }]
                    onChange(newHandles)
                  }
                }}
              >
                <SelectTrigger className="w-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {platforms.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value}>
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
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
