'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/atoms/button'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { ImageCropper } from './ImageCropper'
import { Upload, X, Crop } from 'lucide-react'

export function ImageUpload() {
  const [isUploading, setIsUploading] = useState(false)
  const [showCropper, setShowCropper] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { originalImage, setOriginalImage, croppedImage } = useBadgeStore()

  // Get image dimensions when originalImage changes
  useEffect(() => {
    if (originalImage) {
      const img = new Image()
      img.onload = () => {
        setImageDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
      }
      img.src = URL.createObjectURL(originalImage)
    } else {
      setImageDimensions(null)
    }
  }, [originalImage])

  const handleFileSelect = (file: File) => {
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        alert('Please select a valid image file (PNG, JPG, JPEG, WebP, or GIF)')
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB')
        return
      }
      if (file.size < 10 * 1024) {
        alert('File size must be at least 10KB')
        return
      }

      setIsUploading(true)
      setOriginalImage(file)
      setIsUploading(false)
      setShowCropper(true)
    }
  }

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) handleFileSelect(file)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false) }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) handleFileSelect(files[0])
  }

  const handleRemoveImage = () => {
    setOriginalImage(undefined)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCropClick = () => {
    if (originalImage) setShowCropper(true)
  }

  return (
    <div className="space-y-[5px]">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {!originalImage ? (
        <div
          style={{
            border: '2px dashed var(--sd-border)',
            borderRadius: 'var(--sd-radius)',
            padding: '2.5rem',
            textAlign: 'center',
            transition: 'border-color 0.2s',
            ...(isDragOver ? { borderColor: 'var(--sd-green)', background: 'var(--sd-green-light)' } : {}),
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center gap-2.5">
            <p style={{ fontSize: '18px', color: 'var(--sd-text)', marginBottom: '8px' }}>
              Drag & Drop file here
            </p>
            <p style={{ fontSize: '14px', color: 'var(--sd-muted)', marginBottom: '8px' }}>
              or
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              style={{
                color: 'var(--sd-text)',
                borderColor: 'var(--sd-border)',
                background: 'transparent',
                borderRadius: 'var(--sd-radius)',
              }}
            >
              {isUploading ? 'Uploading...' : 'Browse Files'}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div
            className="flex items-center justify-between p-3 rounded-lg"
            style={{ background: 'var(--sd-card2)' }}
          >
            <div className="flex items-center space-x-3">
              <img
                src={URL.createObjectURL(originalImage)}
                alt="Preview"
                className="w-24 h-24 rounded object-cover"
              />
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--sd-text)' }}>
                  {originalImage.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--sd-muted)' }}>
                  {(originalImage.size / 1024 / 1024).toFixed(2)} MB
                  {imageDimensions && (
                    <span className="ml-2">
                      • {imageDimensions.width} × {imageDimensions.height}px
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemoveImage}
              style={{ color: 'var(--sd-muted)' }}
              className="hover:text-red-400"
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
              style={{
                color: 'var(--sd-text)',
                borderColor: 'var(--sd-border)',
                background: 'transparent',
                borderRadius: 'var(--sd-radius)',
              }}
            >
              Change Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCropClick}
              style={{
                color: 'var(--sd-text)',
                borderColor: 'var(--sd-border)',
                background: 'transparent',
                borderRadius: 'var(--sd-radius)',
              }}
            >
              <Crop className="h-4 w-4 mr-1" />
              Crop Photo
            </Button>
          </div>
        </div>
      )}

      <ImageCropper
        isOpen={showCropper}
        onClose={() => setShowCropper(false)}
      />
    </div>
  )
}
