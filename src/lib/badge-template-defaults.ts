import type { BadgeTemplateConfig } from '@/types/badge-template'

export const COG_CLASSIC_CONFIG: BadgeTemplateConfig = {
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

export const FALL_COG_CONFIG: BadgeTemplateConfig = {
  dimensions: { width: 280, height: 380 },
  background: {
    type: 'gradient',
    gradientFrom: '#000000',
    gradientTo: '#6d0505',
    gradientDirection: 'to bottom',
  },
  textColor: '#ffffff',
  fontFamily: 'Montserrat',
  border: { color: '#660000', width: 1, radius: 10 },
  photo: { shape: 'circle', size: 130, offsetY: 50 },
  socialMedia: { maxHandles: 2 },
}
