import mustache from 'mustache';

export interface TemplateData {
  badgeName: string;
  imageUrl?: string;
  socialMediaHandles: Array<{
    platform: string;
    handle: string;
    iconUrl: string;
  }>;
  decorations: {
    frills: {
      left: boolean;
      right: boolean;
      lower: boolean;
    };
  };
}

export class TemplateService {
  /**
   * Render a Mustache template with the provided data
   * @param template - The Mustache template string
   * @param data - The data to render into the template
   * @param partials - Optional partials for the template
   * @returns Rendered HTML string
   */
  static renderTemplate(
    template: string, 
    data: TemplateData, 
    partials?: Record<string, string>
  ): string {
    try {
      return mustache.render(template, data, partials);
    } catch (error) {
      console.error('Error rendering template:', error);
      throw new Error(`Template rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate template data structure
   * @param data - The data to validate
   * @returns True if valid, throws error if invalid
   */
  static validateTemplateData(data: TemplateData): boolean {
    if (!data.badgeName || typeof data.badgeName !== 'string') {
      throw new Error('badgeName is required and must be a string');
    }

    if (!Array.isArray(data.socialMediaHandles)) {
      throw new Error('socialMediaHandles must be an array');
    }

    if (data.socialMediaHandles.length > 2) {
      throw new Error('Maximum 2 social media handles allowed');
    }

    if (!data.decorations || !data.decorations.frills) {
      throw new Error('decorations.frills is required');
    }

    return true;
  }

  /**
   * Prepare template data from badge store data
   * @param badgeData - Raw badge data from store
   * @param imageUrl - Optional image URL
   * @returns Formatted template data
   */
  static prepareTemplateData(
    badgeData: {
      badge_name?: string;
      social_media_handles?: Array<{
        platform: string;
        handle: string;
      }>;
    },
    imageUrl?: string
  ): TemplateData {
    return {
      badgeName: badgeData.badge_name || 'BADGE NAME',
      imageUrl: imageUrl,
      socialMediaHandles: (badgeData.social_media_handles || []).map(handle => ({
        platform: handle.platform,
        handle: handle.handle,
        iconUrl: this.getPlatformIconUrl(handle.platform)
      })),
      decorations: {
        frills: { 
          left: true, 
          right: true, 
          lower: true 
        }
      }
    };
  }

  /**
   * Get platform icon URL for social media platforms
   * @param platform - Platform name
   * @returns Icon URL or empty string
   */
  private static getPlatformIconUrl(platform: string): string {
    const iconMap: Record<string, string> = {
      'x': '/assets/social-icons/x-icon-white.svg',
      'bluesky': '/assets/social-icons/bluesky-icon-white.svg',
      'telegram': '/assets/social-icons/telegram-icon-white.svg',
      'recon': '/assets/social-icons/recon-icon-color.svg',
      'furaffinity': '/assets/social-icons/furaffinity-icon-white.svg',
      'fetlife': '/assets/social-icons/fetlife-icon-white.svg',
      'discord': '/assets/social-icons/discord-icon-white.svg',
      'instagram': '/assets/social-icons/instagram-icon-white.svg',
      'other': '/assets/social-icons/x-icon-white.svg', // fallback
      'none': ''
    };

    return iconMap[platform] || '';
  }
}
