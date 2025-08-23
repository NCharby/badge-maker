export interface SocialMediaHandle {
  platform: 'x' | 'bluesky' | 'telegram' | 'recon' | 'furaffinity' | 'fetlife' | 'discord' | 'instagram' | 'other';
  handle: string;
}

export interface BadgeData {
  badge_name: string;
  email: string;
  social_media_handles: SocialMediaHandle[];
  photo?: File;
}

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
  aspectRatio: 1;
  minWidth: 300;
  minHeight: 300;
  flipHorizontal?: boolean;
  flipVertical?: boolean;
}
