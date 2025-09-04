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
              <Label className="text-[16px] font-normal text-white font-montserrat">
                Social {index + 1} (Optional)
              </Label>
              <span className="text-[14px] text-[#949494] font-montserrat">
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
                     const newHandles = [...value, { platform: 'none' as const, handle: e.target.value }]
                     onChange(newHandles)
                   }
                }}
                className="flex-1 h-[41px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] font-open-sans text-[16px]"
              />
              
              {isActive && handle.platform !== 'none' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeHandle(index)}
                  className="px-3 h-[41px] border border-[#5c5c5c] text-white hover:text-red-400 flex items-center justify-center"
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
                    const newHandles = [...value, { platform: newValue as SocialMediaHandle['platform'], handle: '' }]
                    onChange(newHandles)
                  }
                }}
              >
                <SelectTrigger className="w-[140px] h-[41px] bg-[#c0c0c0] border-[#c0c0c0] text-black rounded-[3px] font-open-sans text-[16px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#111111] border-[#5c5c5c] text-white">
                  {platforms.map((platform) => (
                    <SelectItem key={platform.value} value={platform.value} className="text-white hover:bg-[#2d2d2d]">
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
