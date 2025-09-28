import dynamic from 'next/dynamic';

// Event-specific badge components
const CogClassic2026Badge = dynamic(() => import('./cog-classic-2026/BadgePreview').then(mod => ({ default: mod.BadgePreview })));
const FallCog2025Badge = dynamic(() => import('./fall-cog-2025/BadgePreview').then(mod => ({ default: mod.BadgePreview })));
const DefaultBadge = dynamic(() => import('./default/BadgePreview').then(mod => ({ default: mod.BadgePreview })));

// Factory function to get the appropriate badge component for an event
export function getEventBadgeComponent(eventSlug: string) {
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
export { CogClassic2026Badge, FallCog2025Badge, DefaultBadge };
