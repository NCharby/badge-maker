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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-12 max-w-7xl mx-auto">
      {/* Form Section */}
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* BASICS Section */}
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">BASICS</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Contact Email */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="email" className="text-sm font-medium">Contact Email*</Label>
              </div>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                onBlur={(e) => handleFormChange('email', e.target.value)}
                placeholder="hello@example.com"
                className="h-10"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Badge Name */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="badge_name" className="text-sm font-medium">Badge Name*</Label>
                <span className="text-xs text-muted-foreground">
                  {form.watch('badge_name')?.length || 0}/85
                </span>
              </div>
              <Input
                id="badge_name"
                {...form.register('badge_name')}
                onBlur={(e) => handleFormChange('badge_name', e.target.value)}
                placeholder="Sgt. Thunder Beef"
                className="h-10"
              />
              {form.formState.errors.badge_name && (
                <p className="text-sm text-destructive">{form.formState.errors.badge_name.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PHOTO Section */}
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">PHOTO</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please refrain from using any pornography (e.g. genitals or sex acts)
            </p>
            <ImageUpload />
            <div className="text-xs text-muted-foreground">
              Max size: 1MB Accepted Types: .jpg .png .gif
            </div>
          </CardContent>
        </Card>

        {/* SOCIALS Section */}
        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">SOCIALS</CardTitle>
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
        <div className="flex gap-4">
          <Button 
            type="button" 
            variant="outline" 
            className="flex-1 h-10"
            onClick={() => form.reset()}
          >
            Reset
          </Button>
          <Button 
            type="submit" 
            className="flex-1 h-10" 
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
