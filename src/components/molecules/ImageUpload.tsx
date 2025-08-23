'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/atoms/button'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { Upload, X } from 'lucide-react'

export function ImageUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { originalImage, setOriginalImage } = useBadgeStore()

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }

      setIsUploading(true)
      setOriginalImage(file)
      setIsUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setOriginalImage(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!originalImage ? (
        <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Drag & Drop file here or
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mb-4"
          >
            {isUploading ? 'Uploading...' : 'Browse Files'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              <img
                src={URL.createObjectURL(originalImage)}
                alt="Preview"
                className="w-12 h-12 rounded object-cover"
              />
              <div>
                <p className="text-sm font-medium">{originalImage.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(originalImage.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Photo
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
