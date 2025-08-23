import { create } from 'zustand'
import { BadgeData, CropData } from '@/types/badge'

interface BadgeStore {
  data: BadgeData;
  cropData?: CropData;
  originalImage?: File;
  croppedImage?: Blob;
  setData: (data: Partial<BadgeData>) => void;
  setCropData: (cropData: CropData) => void;
  setOriginalImage: (file: File | undefined) => void;
  setCroppedImage: (blob: Blob) => void;
  reset: () => void;
}

export const useBadgeStore = create<BadgeStore>((set) => ({
  data: {
    badge_name: '',
    email: '',
    social_media_handles: []
  },
  setData: (newData) => set((state) => ({ 
    data: { ...state.data, ...newData } 
  })),
  setCropData: (cropData) => set({ cropData }),
  setOriginalImage: (file) => set({ originalImage: file }),
  setCroppedImage: (blob) => set({ croppedImage: blob }),
  reset: () => set({
    data: { badge_name: '', email: '', social_media_handles: [] },
    cropData: undefined,
    originalImage: undefined,
    croppedImage: undefined
  })
}))
