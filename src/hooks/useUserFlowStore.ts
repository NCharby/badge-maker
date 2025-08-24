import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserFlowState {
  // Landing page data
  email: string;
  fullName: string;
  dateOfBirth: Date;
  
  // Waiver page data
  emergencyContact: string;
  emergencyPhone: string;
  signature: string | null;
  hasReadTerms: boolean;
  waiverId: string | null;
  
  // Actions
  setLandingData: (data: { email: string; fullName: string; dateOfBirth: Date }) => void;
  setWaiverData: (data: { emergencyContact: string; emergencyPhone: string; signature: string | null; hasReadTerms: boolean }) => void;
  setSignature: (signature: string | null) => void;
  setHasReadTerms: (hasReadTerms: boolean) => void;
  setWaiverId: (waiverId: string) => void;
  clearAll: () => void;
}

export const useUserFlowStore = create<UserFlowState>()(
  persist(
    (set) => ({
      // Initial state
      email: '',
      fullName: '',
      dateOfBirth: new Date('2000-01-01'),
      emergencyContact: '',
      emergencyPhone: '',
      signature: null,
      hasReadTerms: false,
      waiverId: null,
      
      // Actions
      setLandingData: (data) => set({
        email: data.email,
        fullName: data.fullName,
        dateOfBirth: data.dateOfBirth,
      }),
      
      setWaiverData: (data) => set({
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        signature: data.signature,
        hasReadTerms: data.hasReadTerms,
      }),
      
      setSignature: (signature) => set({ signature }),
      
      setHasReadTerms: (hasReadTerms) => set({ hasReadTerms }),
      
      setWaiverId: (waiverId) => set({ waiverId }),
      
      clearAll: () => set({
        email: '',
        fullName: '',
        dateOfBirth: new Date('2000-01-01'),
        emergencyContact: '',
        emergencyPhone: '',
        signature: null,
        hasReadTerms: false,
        waiverId: null,
      }),
    }),
    {
      name: 'user-flow-storage',
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            const parsed = JSON.parse(str);
            return {
              state: {
                ...parsed,
                dateOfBirth: parsed.dateOfBirth ? new Date(parsed.dateOfBirth) : new Date('2000-01-01'),
              }
            };
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          const state = value.state;
          const serialized = {
            ...state,
            dateOfBirth: state.dateOfBirth?.toISOString() || new Date('2000-01-01').toISOString(),
          };
          localStorage.setItem(name, JSON.stringify(serialized));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
