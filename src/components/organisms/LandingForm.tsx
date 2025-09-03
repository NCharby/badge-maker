'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { DateOfBirthInput } from '@/components/molecules/DateOfBirthInput';
import { DietaryAndVolunteeringForm } from '@/components/molecules/DietaryAndVolunteeringForm';
import { FormErrorHandler } from '@/components/molecules/FormErrorHandler';
import { useUserFlowStore } from '@/hooks/useUserFlowStore';
import { useErrorHandler } from '@/hooks/useErrorHandler';

/**
 * LandingForm component that supports pre-population via query parameters
 * 
 * Query Parameters:
 * - email: Pre-populates the email field
 * - name: Pre-populates the full name field
 * 
 * Example URLs:
 * - /landing?email=user@example.com&name=John%20Doe
 * - /landing?email=alice@company.com&name=Alice%20Smith
 * 
 * This allows users to start the flow with pre-filled data for better UX
 */
interface LandingFormProps {
  eventSlug: string;
}

export function LandingForm({ eventSlug }: LandingFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    email, 
    firstName, 
    lastName, 
    dateOfBirth, 
    dietaryRestrictions,
    dietaryRestrictionsOther,
    volunteeringInterests,
    additionalNotes,
    setLandingData,
    setEventSlug
  } = useUserFlowStore();
  
  const { setError, clearError } = useErrorHandler();
  
  // Get pre-populated values from query parameters first, then store data, then defaults
  const prePopulatedEmail = searchParams.get('email') || email || '';
  const prePopulatedFirstName = searchParams.get('firstName') || firstName || '';
  const prePopulatedLastName = searchParams.get('lastName') || lastName || '';
  
  const [formData, setFormData] = useState({
    email: prePopulatedEmail,
    firstName: prePopulatedFirstName,
    lastName: prePopulatedLastName,
    dateOfBirth: dateOfBirth || new Date('2000-01-01'),
    dietaryRestrictions: dietaryRestrictions || [],
    dietaryRestrictionsOther: dietaryRestrictionsOther || '',
    volunteeringInterests: volunteeringInterests || [],
    additionalNotes: additionalNotes || '',
  });

  // Set event context and update form when query parameters change
  useEffect(() => {
    // Set event context
    setEventSlug(eventSlug);
    
    const queryEmail = searchParams.get('email');
    const queryFirstName = searchParams.get('firstName');
    const queryLastName = searchParams.get('lastName');
    
    if (queryEmail || queryFirstName || queryLastName) {
      setFormData(prev => ({
        ...prev,
        email: queryEmail || prev.email,
        firstName: queryFirstName || prev.firstName,
        lastName: queryLastName || prev.lastName,
      }));
    }
  }, [eventSlug, searchParams, setEventSlug]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    
    // Validate form
    const errors: Record<string, string> = {};
    if (!formData.email) errors.email = 'Email is required';
    if (!formData.firstName) errors.firstName = 'First name is required';
    if (!formData.lastName) errors.lastName = 'Last name is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    
    try {
      // Store form data in Zustand store
      setLandingData({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth,
        dietaryRestrictions: formData.dietaryRestrictions,
        dietaryRestrictionsOther: formData.dietaryRestrictionsOther,
        volunteeringInterests: formData.volunteeringInterests,
        additionalNotes: formData.additionalNotes,
      });
      
      // Clear any previous errors
      setFormErrors({});
      
      // Navigate to waiver page
      router.push(`/${eventSlug}/waiver`);
    } catch (error) {
      setError(error instanceof Error ? error : String(error));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#1a1a1a] flex flex-col gap-6 items-start justify-center px-8 py-10 rounded-[10px] w-full border border-[#333333]">
      <h2 className="font-montserrat font-normal text-white text-3xl text-left w-full mb-2">
        HELLO
      </h2>
      <p className="font-open-sans font-normal text-white text-base mb-6">
        Thank you for being here! We need a few details from you.
      </p>
      
      {/* Form Fields */}
      <div className="flex flex-col gap-6 w-full">
        {/* Email Input */}
        <div className="flex flex-col gap-2 w-full">
          <Label className="font-montserrat font-normal text-white text-base">
            Contact Email*
          </Label>
          <Input 
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="hello@example.com"
            className="w-full bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] h-12"
            required
          />
        </div>
        
        {/* Name and Date of Birth */}
        <div className="flex gap-6 items-start justify-start w-full">
          <div className="flex flex-col gap-2 flex-1">
            <Label className="font-montserrat font-normal text-white text-base">
              First Name*
            </Label>
            <Input 
              type="text"
              value={formData.firstName}
              onChange={(e) => handleInputChange('firstName', e.target.value)}
              placeholder="First Name"
              className="w-full bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] h-12"
              required
            />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <Label className="font-montserrat font-normal text-white text-base">
              Last Name*
            </Label>
            <Input 
              type="text"
              value={formData.lastName}
              onChange={(e) => handleInputChange('lastName', e.target.value)}
              placeholder="Last Name"
              className="w-full bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] h-12"
              required
            />
          </div>
        </div>
        
        {/* Date of Birth */}
        <div className="flex flex-col gap-2 w-full">
          <DateOfBirthInput 
            value={formData.dateOfBirth}
            onChange={(date) => handleInputChange('dateOfBirth', date)}
          />
        </div>
      </div>

      {/* Dietary and Volunteering Section */}
      <div className="flex flex-col gap-5 w-full p-2.5">
        <DietaryAndVolunteeringForm
          dietaryRestrictions={formData.dietaryRestrictions}
          dietaryRestrictionsOther={formData.dietaryRestrictionsOther}
          volunteeringInterests={formData.volunteeringInterests}
          additionalNotes={formData.additionalNotes}
          onDietaryRestrictionsChange={(restrictions) => handleInputChange('dietaryRestrictions', restrictions)}
          onDietaryRestrictionsOtherChange={(other) => handleInputChange('dietaryRestrictionsOther', other)}
          onVolunteeringInterestsChange={(interests) => handleInputChange('volunteeringInterests', interests)}
          onAdditionalNotesChange={(notes) => handleInputChange('additionalNotes', notes)}
        />
      </div>

      {/* Error Display */}
      <FormErrorHandler errors={formErrors} className="w-full" />
      
      {/* Submit Button */}
      <div className="flex justify-center w-full pt-6">
        <Button
          type="submit"
          className="bg-white hover:bg-gray-100 text-[#111111] px-8 py-3 text-lg font-semibold font-montserrat rounded-[3px]"
        >
          Continue to Waiver
        </Button>
      </div>
    </form>
  );
}
