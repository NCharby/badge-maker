'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { useUserFlowStore } from '@/hooks/useUserFlowStore'
import { BadgePreview } from '@/components/organisms/BadgePreview'
import { ImageUpload } from '@/components/molecules/ImageUpload'
import { SocialMediaInput } from '@/components/molecules/SocialMediaInput'

const badgeSchema = z.object({
  badge_name: z.string().min(1, 'Badge name is required'),
  email: z.string().email('Please enter a valid email'),
  social_media_handles: z.array(z.object({
    platform: z.enum(['none', 'x', 'bluesky', 'telegram', 'recon', 'furaffinity', 'fetlife', 'discord', 'instagram', 'other']),
    handle: z.string().min(1, 'Handle is required')
  })).max(3, 'Maximum 3 social media handles allowed')
})

type BadgeFormData = z.infer<typeof badgeSchema>

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
  { value: 'other', label: 'Other' }
]

/**
 * BadgeCreationForm component that supports pre-population via query parameters
 * 
 * Query Parameters:
 * - email: Pre-populates the email field
 * - name: Pre-populates the badge name field
 * 
 * Example URLs:
 * - /test?email=user@example.com&name=John%20Doe
 * - /?email=alice@company.com&name=Alice%20Smith
 */
export function BadgeCreationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data, setData } = useBadgeStore()
  const { email: waiverEmail, fullName: waiverName, waiverId } = useUserFlowStore()
  const searchParams = useSearchParams()
  
  // Get pre-populated values from waiver data first, then query parameters, then existing badge data
  const prePopulatedEmail = waiverEmail || searchParams.get('email') || data.email
  const prePopulatedName = waiverName || searchParams.get('name') || data.badge_name
  
  const form = useForm<BadgeFormData>({
    resolver: zodResolver(badgeSchema),
    defaultValues: {
      badge_name: prePopulatedName,
      email: prePopulatedEmail,
      social_media_handles: data.social_media_handles
    }
  })

  // Update form and store when query parameters change
  useEffect(() => {
    if (prePopulatedEmail !== data.email || prePopulatedName !== data.badge_name) {
      const updatedData = {
        badge_name: prePopulatedName,
        email: prePopulatedEmail,
        social_media_handles: data.social_media_handles
      }
      
      setData(updatedData)
      form.reset(updatedData)
    }
  }, [prePopulatedEmail, prePopulatedName, data.social_media_handles, setData, form])

  const onSubmit = async (formData: BadgeFormData) => {
    setIsSubmitting(true)
    try {
      setData(formData)
      
      // Upload images if they exist
      let originalImageUrl = null
      let croppedImageUrl = null
      
      const { originalImage, croppedImage } = useBadgeStore.getState()
      
      if (originalImage) {
        try {
          const originalFormData = new FormData()
          originalFormData.append('file', originalImage)
          originalFormData.append('type', 'original')
          
          const originalResponse = await fetch('/api/upload', {
            method: 'POST',
            body: originalFormData
          })
          
          if (originalResponse.ok) {
            const originalData = await originalResponse.json()
            originalImageUrl = originalData.url
          } else {
            console.warn('Original image upload failed, continuing without image')
          }
        } catch (error) {
          console.warn('Original image upload error:', error)
        }
      }
      
      if (croppedImage) {
        try {
          const croppedFormData = new FormData()
          croppedFormData.append('file', croppedImage)
          croppedFormData.append('type', 'cropped')
          
          const croppedResponse = await fetch('/api/upload', {
            method: 'POST',
            body: croppedFormData
          })
          
          if (croppedResponse.ok) {
            const croppedData = await croppedResponse.json()
            croppedImageUrl = croppedData.url
          } else {
            console.warn('Cropped image upload failed, continuing without image')
          }
        } catch (error) {
          console.warn('Cropped image upload error:', error)
        }
      }
      
      // Create badge in database
      const badgeResponse = await fetch('/api/badges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          badge_name: formData.badge_name,
          email: formData.email,
          social_media_handles: formData.social_media_handles,
          original_image_url: originalImageUrl,
          cropped_image_url: croppedImageUrl,
          crop_data: {
            // Add any crop data if needed
            timestamp: new Date().toISOString()
          },
          waiver_id: waiverId
        })
      })
      
      if (badgeResponse.ok) {
        const badgeData = await badgeResponse.json()
        console.log('Badge created successfully:', badgeData)
        
        // Redirect to confirmation page
        window.location.href = `/confirmation?badge_id=${badgeData.badge_id}`
      } else {
        const errorData = await badgeResponse.json()
        console.error('Badge creation failed:', errorData)
        alert('Failed to create badge. Please try again.')
      }
      
    } catch (error) {
      console.error('Error submitting badge:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFormChange = (field: keyof BadgeFormData, value: any) => {
    form.setValue(field, value)
    setData({ [field]: value })
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
      {/* Form Section */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* BASICS Section */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] shadow-2xl">
          <CardHeader className="pb-5">
            <CardTitle className="text-[32px] font-normal text-white font-montserrat leading-[normal]">
              BASICS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Contact Email */}
            <div className="space-y-[5px]">
              <div className="flex justify-between items-center">
                <Label htmlFor="email" className="text-[16px] font-normal text-white font-montserrat">
                  Contact Email*
                </Label>
              </div>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                onBlur={(e) => handleFormChange('email', e.target.value)}
                placeholder="hello@example.com"
                className="h-[41px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] font-open-sans text-[16px]"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Badge Name */}
            <div className="space-y-[5px]">
              <div className="flex justify-between items-center">
                <Label htmlFor="badge_name" className="text-[16px] font-normal text-white font-montserrat">
                  Badge Name*
                </Label>
                <span className="text-[14px] text-[#949494] font-montserrat">
                  {form.watch('badge_name')?.length || 0}/85
                </span>
              </div>
              <Input
                id="badge_name"
                {...form.register('badge_name')}
                onBlur={(e) => handleFormChange('badge_name', e.target.value)}
                placeholder="Sgt. Thunder Beef"
                className="h-[41px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] font-open-sans text-[16px]"
              />
              {form.formState.errors.badge_name && (
                <p className="text-sm text-destructive">{form.formState.errors.badge_name.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PHOTO Section */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] shadow-2xl">
          <CardHeader className="pb-5">
            <CardTitle className="text-[32px] font-normal text-white font-montserrat leading-[normal]">
              PHOTO
            </CardTitle>
            <p className="text-[16px] font-normal text-white font-open-sans">
              Please refrain from using any pornography (e.g. genitals or sex acts)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ImageUpload />
            <div className="text-[13px] text-white font-open-sans">
              Max size: 5MB • Min size: 10KB • Accepted: PNG, JPG, JPEG, WebP, GIF
            </div>
          </CardContent>
        </Card>

        {/* SOCIALS Section */}
        <Card className="bg-[#111111] border-[#111111] rounded-[10px] shadow-2xl">
          <CardHeader className="pb-5">
            <CardTitle className="text-[32px] font-normal text-white font-montserrat leading-[normal]">
              SOCIALS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SocialMediaInput
              platforms={socialMediaPlatforms}
              value={form.watch('social_media_handles')}
              onChange={(handles) => handleFormChange('social_media_handles', handles)}
              error={form.formState.errors.social_media_handles?.message}
            />
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-2.5">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1 h-[41px] bg-transparent border-[#767676] text-white font-open-sans text-[16px] rounded-[3px] hover:bg-[#767676] hover:text-black"
            onClick={() => {
              form.reset()
              useBadgeStore.getState().reset()
            }}
          >
            Reset
          </Button>
          <Button 
            type="submit" 
            className="flex-1 h-[41px] bg-[#c0c0c0] text-black font-open-sans text-[16px] rounded-[3px] hover:bg-white" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Finished'}
          </Button>
        </div>
      </form>

      {/* Preview Section */}
      <div className="flex justify-center">
        <BadgePreview />
      </div>
    </div>
  )
}
