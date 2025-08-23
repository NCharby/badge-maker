'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card'
import { Button } from '@/components/atoms/button'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { useBadgeStore } from '@/hooks/useBadgeStore'
import { BadgePreview } from '@/components/organisms/BadgePreview'
import { ImageUpload } from '@/components/molecules/ImageUpload'
import { SocialMediaInput } from '@/components/molecules/SocialMediaInput'

const badgeSchema = z.object({
  badge_name: z.string().min(1, 'Badge name is required'),
  email: z.string().email('Please enter a valid email'),
  social_media_handles: z.array(z.object({
    platform: z.enum(['x', 'bluesky', 'telegram', 'recon', 'furaffinity', 'fetlife', 'discord', 'instagram', 'other']),
    handle: z.string().min(1, 'Handle is required')
  })).max(3, 'Maximum 3 social media handles allowed')
})

type BadgeFormData = z.infer<typeof badgeSchema>

const socialMediaPlatforms = [
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

export function BadgeCreationForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { data, setData } = useBadgeStore()
  
  const form = useForm<BadgeFormData>({
    resolver: zodResolver(badgeSchema),
    defaultValues: {
      badge_name: data.badge_name,
      email: data.email,
      social_media_handles: data.social_media_handles
    }
  })

  const onSubmit = async (formData: BadgeFormData) => {
    setIsSubmitting(true)
    try {
      setData(formData)
      // TODO: Implement badge submission logic in Segment 3
      console.log('Badge data:', formData)
    } catch (error) {
      console.error('Error submitting badge:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFormChange = (field: keyof BadgeFormData, value: any) => {
    form.setValue(field, value)
    setData({ [field]: value })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Form Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Badge Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Badge Name */}
              <div className="space-y-2">
                <Label htmlFor="badge_name">Badge Name</Label>
                <Input
                  id="badge_name"
                  {...form.register('badge_name')}
                  onBlur={(e) => handleFormChange('badge_name', e.target.value)}
                  placeholder="Enter your badge name"
                />
                {form.formState.errors.badge_name && (
                  <p className="text-sm text-red-500">{form.formState.errors.badge_name.message}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...form.register('email')}
                  onBlur={(e) => handleFormChange('email', e.target.value)}
                  placeholder="Enter your email"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-500">{form.formState.errors.email.message}</p>
                )}
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photo</Label>
                <ImageUpload />
              </div>

              {/* Social Media Handles */}
              <div className="space-y-2">
                <Label>Social Media Handles (up to 3)</Label>
                <SocialMediaInput
                  platforms={socialMediaPlatforms}
                  value={form.watch('social_media_handles')}
                  onChange={(handles) => handleFormChange('social_media_handles', handles)}
                  error={form.formState.errors.social_media_handles?.message}
                />
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating Badge...' : 'Create Badge'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Preview Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Live Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <BadgePreview />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
