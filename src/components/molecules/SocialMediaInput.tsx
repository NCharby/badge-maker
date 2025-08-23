'use client'

import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
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
      {value.map((handle, index) => (
        <div key={index} className="flex space-x-2">
          <Select
            value={handle.platform}
            onValueChange={(newValue) => updateHandle(index, 'platform', newValue)}
          >
            <SelectTrigger className="w-32">
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
          
          <Input
            placeholder="Handle"
            value={handle.handle}
            onChange={(e) => updateHandle(index, 'handle', e.target.value)}
            className="flex-1"
          />
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeHandle(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      
      {value.length < 3 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addHandle}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Social Media Handle
        </Button>
      )}
      
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  )
}
