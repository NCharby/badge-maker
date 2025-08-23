'use client'

import { useState, useRef } from 'react'
import { Cropper, CropperRef } from 'react-advanced-cropper'
import 'react-advanced-cropper/dist/style.css'
import { Button } from '@/components/atoms/button'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { RotateCcw, RotateCw, FlipHorizontal, FlipVertical, X, Check } from 'lucide-react'

interface ImageCropperProps {
  isOpen: boolean
  onClose: () => void
}

export function ImageCropper({ isOpen, onClose }: ImageCropperProps) {
  const { originalImage, setCroppedImage } = useBadgeStore()
  const cropperRef = useRef<CropperRef>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen || !originalImage) return null

  const handleCrop = async () => {
    if (!cropperRef.current) return

    setIsProcessing(true)
    try {
      const canvas = cropperRef.current.getCanvas({
        width: 400,
        height: 400,
        minWidth: 300,
        minHeight: 300,
        maxWidth: 800,
        maxHeight: 800,
      })

      if (canvas) {
        canvas.toBlob((blob) => {
          if (blob) {
            setCroppedImage(blob)
            onClose()
          }
        }, 'image/jpeg', 0.9)
      }
    } catch (error) {
      console.error('Error cropping image:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRotate = (direction: 'clockwise' | 'counterclockwise') => {
    if (!cropperRef.current) return
    
    const angle = direction === 'clockwise' ? 90 : -90
    ;(cropperRef.current as any).rotateImage(angle)
  }

  const handleFlip = (direction: 'horizontal' | 'vertical') => {
    if (!cropperRef.current) return
    
    const horizontal = direction === 'horizontal'
    const vertical = direction === 'vertical'
    
    ;(cropperRef.current as any).flipImage(horizontal, vertical)
  }

  const imageUrl = URL.createObjectURL(originalImage)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-[#111111] rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-[24px] font-normal text-white font-montserrat">
            Crop Your Photo
          </h2>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="text-white hover:text-red-400"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Cropper Container */}
        <div className="relative bg-[#2d2d2d] rounded-lg overflow-hidden mb-4" style={{ height: '60vh' }}>
          <div className="relative w-full h-full">
            <Cropper
              ref={cropperRef}
              src={imageUrl}
              style={{ width: '100%', height: '100%' }}
              className="cropper"
              stencilProps={{
                // @ts-ignore
                aspectRatio: 1,
                grid: true
              }}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          {/* Left side - Image manipulation tools */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleFlip('horizontal')}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              <FlipHorizontal className="h-4 w-4 mr-1" />
              Flip H
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRotate('counterclockwise')}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Rotate L
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRotate('clockwise')}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              <RotateCw className="h-4 w-4 mr-1" />
              Rotate R
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleFlip('vertical')}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              <FlipVertical className="h-4 w-4 mr-1" />
              Flip V
            </Button>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-transparent border-[#767676] text-white font-open-sans text-[16px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCrop}
              disabled={isProcessing}
              className="bg-[#c0c0c0] text-black font-open-sans text-[16px] rounded-[3px] hover:bg-white"
            >
              {isProcessing ? (
                'Processing...'
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
