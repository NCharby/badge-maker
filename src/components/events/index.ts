import dynamic from 'next/dynamic';
import React from 'react';
import type { BadgeTemplateConfig } from '@/types/badge-template';
import type { SocialMediaHandle } from '@/types/badge';

// Shared props interface for all badge preview components
export interface BadgePreviewProps {
  badgeData?: { badge_name?: string; social_media_handles?: SocialMediaHandle[] };
  imageUrl?: string;
}

// Event-specific badge components
const CogClassic2026Badge = dynamic(() => import('./cog-classic-2026/BadgePreview').then(mod => ({ default: mod.BadgePreview })));
const FallCog2025Badge = dynamic(() => import('./fall-cog-2025/BadgePreview').then(mod => ({ default: mod.BadgePreview })));
const DefaultBadge = dynamic(() => import('./default/BadgePreview').then(mod => ({ default: mod.BadgePreview })));
const DataDrivenBadgePreview = dynamic(() => import('./DataDrivenBadgePreview'));

// Factory function to get the appropriate badge component for an event.
// When a template config is provided, returns a DataDrivenBadgePreview wrapper
// that renders from config. Otherwise falls back to slug-based hardcoded components.
//
// Return type is intentionally `any` component because the existing per-event
// badge components have slightly varying prop signatures (some make badgeData
// fields required, some optional, some accept no props). Callers uniformly pass
// BadgePreviewProps which is accepted by all variants at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEventBadgeComponent(
  eventSlug: string,
  templateConfig?: BadgeTemplateConfig | null,
  backgroundImageUrl?: string | null,
): React.ComponentType<any> {
  if (templateConfig) {
    // Capture config in a stable component reference
    const config = templateConfig;
    const bgUrl = backgroundImageUrl;
    const TemplatePreview: React.FC<BadgePreviewProps> = (props) => {
      return React.createElement(DataDrivenBadgePreview, {
        config,
        backgroundImageUrl: bgUrl,
        badgeData: props.badgeData,
        imageUrl: props.imageUrl,
      });
    };
    TemplatePreview.displayName = 'TemplatePreview';
    return TemplatePreview;
  }

  switch (eventSlug) {
    case 'cog-classic-2026':
      return CogClassic2026Badge;
    case 'fall-cog-2025':
      return FallCog2025Badge;
    case 'default':
      return DefaultBadge;
    default:
      // Fallback to default badge for unknown events
      return DefaultBadge;
  }
}

// Export individual components for direct use if needed
export { CogClassic2026Badge, FallCog2025Badge, DefaultBadge, DataDrivenBadgePreview };
