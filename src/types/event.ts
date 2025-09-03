export interface Event {
  id: string;
  slug: string;
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  isActive: boolean;
  templateId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventData {
  event: Event;
  template: any; // Template configuration
}

// Updated user data interface with separate name fields
export interface UserData {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: Date;
  emergencyContact: string;
  emergencyPhone: string;
  dietaryRestrictions: string[];
  dietaryRestrictionsOther: string;
  volunteeringInterests: string[];
  additionalNotes: string;
}

// Event-specific data interfaces
export interface EventPhoto {
  eventSlug: string;
  photoUrl: string;
  type: 'original' | 'cropped';
}

export interface EventBadgeData {
  eventSlug: string;
  badgeName: string;
  email: string;
  socialMedia?: string;
  photoUrl: string;
}
