'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/atoms/button'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { ImageCropper } from './ImageCropper'
import { Upload, X, Crop } from 'lucide-react'

export function ImageUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { originalImage, setOriginalImage, croppedImage } = useBadgeStore()

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
      setShowCropper(true)
    }
  }

  const handleRemoveImage = () => {
    setOriginalImage(undefined)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleCropClick = () => {
    if (originalImage) {
      setShowCropper(true)
    }
  }

  return (
    <div className="space-y-[5px]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!originalImage ? (
        <div className="border-[#747474] border-dashed border rounded-lg p-10 text-center relative">
          <div className="flex flex-col items-center justify-center gap-2.5">
            <p className="text-[20px] text-white font-open-sans font-normal leading-[normal] mb-2.5">
              Drag & Drop file here
            </p>
            <p className="text-[16px] text-white font-open-sans font-normal leading-[normal] mb-2.5">
              or
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="px-5 py-2.5 bg-transparent border-[#767676] text-white font-open-sans text-[16px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              {isUploading ? 'Uploading...' : 'Browse Files'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center space-x-3">
              <img
                src={croppedImage ? URL.createObjectURL(croppedImage) : URL.createObjectURL(originalImage)}
                alt="Preview"
                className="w-12 h-12 rounded object-cover"
              />
              <div>
                <p className="text-sm font-medium text-white">{originalImage.name}</p>
                <p className="text-xs text-[#949494]">
                  {(originalImage.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              className="text-white hover:text-red-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[16px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              Change Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCropClick}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[16px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              <Crop className="h-4 w-4 mr-1" />
              Crop Photo
            </Button>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      <ImageCropper 
        isOpen={showCropper} 
        onClose={() => setShowCropper(false)} 
      />
    </div>
  )
}
