/**
 * Badge asset configuration and mappings
 * Centralized configuration for badge design assets
 */

// Platform icon mapping for social media handles
export const platformIconMap = {
  x: '/assets/social-icons/x-icon-white.svg',
  bluesky: '/assets/social-icons/bluesky-icon-white.svg',
  telegram: '/assets/social-icons/telegram-icon-white.svg',
  recon: '/assets/social-icons/recon-icon-color.svg',
  furaffinity: '/assets/social-icons/furaffinity-icon-white.svg',
  fetlife: '/assets/social-icons/fetlife-icon-white.svg',
  discord: '/assets/social-icons/discord-icon-white.svg',
  instagram: '/assets/social-icons/instagram-icon-white.svg',
  other: null // No icon for 'other' platform
} as const;

// Decorative elements for badge background
export const badgeDecorativeElements = {
  frillLeft: '/assets/badge-parts/frill-left.svg',
  frillRight: '/assets/badge-parts/frill-right.svg',
  frillLower: '/assets/badge-parts/frill-lower.svg'
} as const;

// Platform display names (for fallback when icons fail to load)
export const platformDisplayNames = {
  none: '',
  x: 'X',
  bluesky: 'BS',
  telegram: 'TG',
  recon: 'RC',
  furaffinity: 'FA',
  fetlife: 'FL',
  discord: 'DC',
  instagram: 'IG',
  other: 'OT'
} as const;

// Get platform icon URL
export function getPlatformIcon(platform: keyof typeof platformIconMap): string | null {
  return platformIconMap[platform] || null;
}

// Get platform display name
export function getPlatformDisplayName(platform: keyof typeof platformDisplayNames): string {
  return platformDisplayNames[platform] || '';
}
