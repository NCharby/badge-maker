export interface BadgeTemplateConfig {
  dimensions: { width: number; height: number }
  background: {
    type: 'solid' | 'gradient' | 'image'
    color?: string
    gradientFrom?: string
    gradientTo?: string
    gradientDirection?: string
  }
  textColor: string
  fontFamily: string
  border: { color: string; width: number; radius: number }
  photo: {
    shape: 'circle' | 'square' | 'rounded'
    size: number
    offsetY: number
  }
  socialMedia: { maxHandles: 1 | 2 }
}

export const DEFAULT_BADGE_TEMPLATE: BadgeTemplateConfig = {
  dimensions: { width: 284, height: 400 },
  background: {
    type: 'gradient',
    gradientFrom: '#0f2733',
    gradientTo: '#170a2a',
    gradientDirection: 'to bottom',
  },
  textColor: '#ffffff',
  fontFamily: 'Montserrat',
  border: { color: '#cccc64', width: 1, radius: 10 },
  photo: { shape: 'circle', size: 145, offsetY: 60 },
  socialMedia: { maxHandles: 2 },
}

export const FONT_OPTIONS = [
  'Montserrat',
  'Inter',
  'Open Sans',
  'Arial',
  'Georgia',
] as const
