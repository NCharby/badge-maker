# Image Storage Strategy

## 📋 Overview

This document explains how the Badge Maker application stores both original user uploads and cropped/edited versions in a way that's optimized for easy database retrieval and management.

## 🗄 Database Storage Structure

### Badge Table Image Fields

```sql
-- Image storage fields in badges table
original_image_url TEXT,           -- Full URL to original image in Supabase Storage
original_image_filename TEXT,      -- Filename for easy identification
cropped_image_url TEXT,            -- Full URL to cropped image in Supabase Storage
cropped_image_filename TEXT,       -- Filename for easy identification
crop_data JSONB,                   -- Crop coordinates and settings
```

### Example Database Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "badge_name": "John Doe",
  "email": "john@techcorp.com",
  "original_image_url": "https://supabase.co/storage/v1/object/public/badges/original/550e8400-e29b-41d4-a716-446655440000_original.jpg",
  "original_image_filename": "550e8400-e29b-41d4-a716-446655440000_original.jpg",
  "cropped_image_url": "https://supabase.co/storage/v1/object/public/badges/cropped/550e8400-e29b-41d4-a716-446655440000_cropped.jpg",
  "cropped_image_filename": "550e8400-e29b-41d4-a716-446655440000_cropped.jpg",
  "social_media_handles": [
    {
      "platform": "x",
      "handle": "@johndoe"
    },
    {
      "platform": "instagram",
      "handle": "@johndoe_photos"
    },
    {
      "platform": "discord",
      "handle": "johndoe#1234"
    }
  ],
  "crop_data": {
    "x": 100,
    "y": 50,
    "width": 300,
    "height": 300,
    "aspectRatio": 1,
    "rotation": 0,
    "scale": 1.2,
    "flipHorizontal": false,
    "flipVertical": false
  },
  "template_id": "business-classic",
  "badge_data": {
    "fontSize": 16,
    "textColor": "#1f2937",
    "backgroundColor": "#ffffff"
  },
  "status": "published",
  "created_at": "2024-01-15T10:30:00Z"
}
```

## 📁 Supabase Storage Structure

### Storage Bucket Organization

```
badges/
├── original/                    # Original user uploads
│   ├── {badge_id}_original.jpg
│   ├── {badge_id}_original.png
│   └── {badge_id}_original.webp
├── cropped/                     # Cropped/edited versions
│   ├── {badge_id}_cropped.jpg
│   ├── {badge_id}_cropped.png
│   └── {badge_id}_cropped.webp
└── temp/                        # Temporary uploads (cleaned up after 2h)
    └── {session_id}_temp.jpg
```

### File Naming Convention

- **Original Images**: `{badge_id}_original.{extension}`
- **Cropped Images**: `{badge_id}_cropped.{extension}`
- **Temporary Images**: `{session_id}_temp.{extension}`

## 🔄 Image Processing Flow

### 1. User Upload
```typescript
// When user uploads an image
const uploadOriginalImage = async (file: File, badgeId: string) => {
  const filename = `${badgeId}_original.${getFileExtension(file.name)}`;
  const { data, error } = await supabase.storage
    .from('badges')
    .upload(`original/${filename}`, file);
  
  return {
    url: data?.path,
    filename: filename
  };
};
```

### 2. Image Cropping
```typescript
// When user crops the image
const processCroppedImage = async (croppedBlob: Blob, badgeId: string, cropData: CropData) => {
  // Validate minimum dimensions (300x300 pixels)
  const image = new Image();
  image.src = URL.createObjectURL(croppedBlob);
  
  await new Promise((resolve) => {
    image.onload = () => {
      if (image.width < 300 || image.height < 300) {
        throw new Error('Cropped image must be at least 300x300 pixels');
      }
      resolve(null);
    };
  });
  
  const filename = `${badgeId}_cropped.jpg`;
  const { data, error } = await supabase.storage
    .from('badges')
    .upload(`cropped/${filename}`, croppedBlob);
  
  return {
    url: data?.path,
    filename: filename,
    cropData: cropData
  };
};
```

### 3. Database Storage
```typescript
// Store badge data with both image references
const saveBadge = async (badgeData: BadgeData) => {
  const { data, error } = await supabase
    .from('badges')
    .insert({
             badge_name: badgeData.badgeName,
       email: badgeData.email,
      original_image_url: badgeData.originalImageUrl,
      original_image_filename: badgeData.originalImageFilename,
      cropped_image_url: badgeData.croppedImageUrl,
      cropped_image_filename: badgeData.croppedImageFilename,
      crop_data: badgeData.cropData,
             social_media_handles: badgeData.socialMediaHandles.map(handle => ({
         platform: handle.platform,
         handle: handle.handle
       })),
      badge_data: badgeData.badgeConfig
    });
  
  return data;
};
```

## 🔍 Easy Database Retrieval

### Query Examples

#### 1. Get All Badges with Images
```sql
SELECT 
  id,
  badge_name,
  email,
  original_image_url,
  cropped_image_url,
  created_at
FROM badges 
WHERE status = 'published'
ORDER BY created_at DESC;
```

#### 2. Get Badge by ID with Full Image Data
```sql
SELECT 
  *,
  original_image_url,
  cropped_image_url,
  crop_data
FROM badges 
WHERE id = '550e8400-e29b-41d4-a716-446655440000';
```

#### 3. Get Badges by Email Domain
```sql
SELECT 
  id,
  badge_name,
  email,
  original_image_url,
  cropped_image_url,
  created_at
FROM badges 
WHERE email LIKE '%@techcorp.com'
ORDER BY created_at DESC;
```

#### 4. Get Badges Created Today
```sql
SELECT 
  id,
  badge_name,
  email,
  original_image_url,
  cropped_image_url
FROM badges 
WHERE DATE(created_at) = CURRENT_DATE;
```

#### 5. Get Badges with Social Media Handles
```sql
SELECT 
  id,
  badge_name,
  email,
  social_media_handles,
  original_image_url,
  cropped_image_url
FROM badges 
WHERE jsonb_array_length(social_media_handles) > 0;
```

#### 6. Get Badges by Social Media Platform
```sql
SELECT 
  id,
  badge_name,
  email,
  social_media_handles,
  original_image_url,
  cropped_image_url
FROM badges 
WHERE social_media_handles @> '[{"platform": "x"}]';
```

## 🛠 Utility Functions for Retrieval

### TypeScript Interfaces
```typescript
interface BadgeRecord {
  id: string;
  badge_name: string;
  email: string;
  original_image_url?: string;
  original_image_filename?: string;
  cropped_image_url?: string;
  cropped_image_filename?: string;
  crop_data?: CropData;
  social_media_handles: SocialMediaHandle[];
  badge_data: BadgeConfig;
  created_at: string;
  updated_at: string;
}

interface SocialMediaHandle {
  platform: 'x' | 'bluesky' | 'telegram' | 'recon' | 'furaffinity' | 'fetlife' | 'discord' | 'instagram' | 'other';
  handle: string;
}

interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: 1; // Fixed square aspect ratio
  rotation?: number;
  scale?: number;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
  minWidth: 300;
  minHeight: 300;
}
```

### Retrieval Functions
```typescript
// Get all badges with image URLs
export const getAllBadgesWithImages = async () => {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .order('created_at', { ascending: false });
  
  return data;
};

// Get badge by ID with full image data
export const getBadgeById = async (badgeId: string) => {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .eq('id', badgeId)
    .single();
  
  return data;
};

// Get badges by email domain
export const getBadgesByEmailDomain = async (emailDomain: string) => {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .ilike('email', `%@${emailDomain}`)
    .order('created_at', { ascending: false });
  
  return data;
};

// Get badges created in date range
export const getBadgesByDateRange = async (startDate: string, endDate: string) => {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });
  
  return data;
};

// Get badges by social media platform
export const getBadgesByPlatform = async (platform: string) => {
  const { data, error } = await supabase
    .from('badges')
    .select('*')
    .contains('social_media_handles', [{ platform }])
    .order('created_at', { ascending: false });
  
  return data;
};
```

## 📊 Storage Optimization

### Image Processing
- **Original Images**: Stored as uploaded (no processing)
- **Cropped Images**: Converted to JPEG with square aspect ratio (1:1)
- **Quality Settings**: Optimized for badge printing (300 DPI)
- **Minimum Dimensions**: 300x300 pixels for cropped images

### File Size Management
- **Original Upload Limit**: 10MB
- **Cropped Image Target**: < 2MB
- **Automatic Compression**: Applied to cropped images

### Cleanup Strategy
```typescript
// Clean up temporary files after 2 hours
const cleanupTempFiles = async () => {
  const { data, error } = await supabase.storage
    .from('badges')
    .list('temp', {
      limit: 1000
    });
  
  // Delete files older than 2 hours
  const filesToDelete = data.filter(file => {
    const fileAge = Date.now() - new Date(file.created_at).getTime();
    return fileAge > 2 * 60 * 60 * 1000; // 2 hours
  });
  
  // Delete files
  for (const file of filesToDelete) {
    await supabase.storage
      .from('badges')
      .remove([`temp/${file.name}`]);
  }
};
```

## 🔐 Security Considerations

### File Access Control
- **Public Read Access**: For shared badge images
- **Signed URLs**: For temporary access to original images
- **File Type Validation**: Only allow image files (JPG, PNG, WebP)

### Storage Policies
```sql
-- Supabase Storage policies
CREATE POLICY "Public read access for badge images" ON storage.objects
  FOR SELECT USING (bucket_id = 'badges');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'badges' AND auth.role() = 'authenticated');
```

## 📈 Performance Considerations

### Database Indexing
```sql
-- Indexes for efficient querying
CREATE INDEX idx_badges_email ON badges(email);
CREATE INDEX idx_badges_created_at ON badges(created_at);
CREATE INDEX idx_badges_status ON badges(status);
```

### CDN Integration
- **Supabase CDN**: Automatic CDN for all stored images
- **Cache Headers**: Optimized for badge images
- **Geographic Distribution**: Global CDN for fast access

## 🎯 Benefits of This Approach

1. **Easy Retrieval**: All image data is directly accessible in the database
2. **Complete History**: Both original and processed images are preserved
3. **Flexible Queries**: Can filter and search by any badge attribute
4. **Scalable Storage**: Supabase Storage handles large files efficiently
5. **Backup Friendly**: Database records contain all necessary file references
6. **Audit Trail**: Full history of image processing and crop settings

This storage strategy ensures that you can easily retrieve any badge data directly from the database, with all image references and processing information readily available for your management needs.
