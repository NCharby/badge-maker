import { create } from 'zustand';

interface UserFlowState {
  // Event context
  eventSlug: string;
  
  // Landing page data
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  dietaryRestrictions: string[];
  dietaryRestrictionsOther: string;
  volunteeringInterests: string[];
  additionalNotes: string;
  
  // Waiver page data
  emergencyContact: string;
  emergencyPhone: string;
  signature: string | null;
  hasReadTerms: boolean;
  waiverId: string | null;
  
  // Actions
  setEventSlug: (eventSlug: string) => void;
  setLandingData: (data: { 
    email: string; 
    firstName: string;
    lastName: string;
    dateOfBirth: Date;
    dietaryRestrictions: string[];
    dietaryRestrictionsOther: string;
    volunteeringInterests: string[];
    additionalNotes: string;
  }) => void;
  setWaiverData: (data: { emergencyContact: string; emergencyPhone: string; signature: string | null; hasReadTerms: boolean }) => void;
  setSignature: (signature: string | null) => void;
  setHasReadTerms: (hasReadTerms: boolean) => void;
  setWaiverId: (waiverId: string) => void;
  clearAll: () => void;
}

export const useUserFlowStore = create<UserFlowState>()((set) => ({
  // Initial state
  eventSlug: '',
  email: '',
  firstName: '',
  lastName: '',
  dateOfBirth: new Date('2000-01-01'),
  dietaryRestrictions: [],
  dietaryRestrictionsOther: '',
  volunteeringInterests: [],
  additionalNotes: '',
  emergencyContact: '',
  emergencyPhone: '',
  signature: null,
  hasReadTerms: false,
  waiverId: null,
  
  // Actions
  setEventSlug: (eventSlug) => set({ eventSlug }),
  setLandingData: (data) => set({
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    dateOfBirth: data.dateOfBirth,
    dietaryRestrictions: data.dietaryRestrictions,
    dietaryRestrictionsOther: data.dietaryRestrictionsOther,
    volunteeringInterests: data.volunteeringInterests,
    additionalNotes: data.additionalNotes,
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
    eventSlug: '',
    email: '',
    firstName: '',
    lastName: '',
    dateOfBirth: new Date('2000-01-01'),
    dietaryRestrictions: [],
    dietaryRestrictionsOther: '',
    volunteeringInterests: [],
    additionalNotes: '',
    emergencyContact: '',
    emergencyPhone: '',
    signature: null,
    hasReadTerms: false,
    waiverId: null,
  }),
}));
