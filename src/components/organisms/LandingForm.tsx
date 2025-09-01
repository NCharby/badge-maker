'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { DateOfBirthInput } from '@/components/molecules/DateOfBirthInput';
import { DietaryAndVolunteeringForm } from '@/components/molecules/DietaryAndVolunteeringForm';
import { useUserFlowStore } from '@/hooks/useUserFlowStore';

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
export function LandingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { 
    email, 
    fullName, 
    dateOfBirth, 
    dietaryRestrictions,
    dietaryRestrictionsOther,
    volunteeringInterests,
    additionalNotes,
    setLandingData 
  } = useUserFlowStore();
  
  // Get pre-populated values from query parameters first, then store data, then defaults
  const prePopulatedEmail = searchParams.get('email') || email || '';
  const prePopulatedName = searchParams.get('name') || fullName || '';
  
  const [formData, setFormData] = useState({
    email: prePopulatedEmail,
    fullName: prePopulatedName,
    dateOfBirth: dateOfBirth || new Date('2000-01-01'),
    dietaryRestrictions: dietaryRestrictions || [],
    dietaryRestrictionsOther: dietaryRestrictionsOther || '',
    volunteeringInterests: volunteeringInterests || [],
    additionalNotes: additionalNotes || '',
  });

  // Update form when query parameters change
  useEffect(() => {
    const queryEmail = searchParams.get('email');
    const queryName = searchParams.get('name');
    
    if (queryEmail || queryName) {
      setFormData(prev => ({
        ...prev,
        email: queryEmail || prev.email,
        fullName: queryName || prev.fullName,
      }));
    }
  }, [searchParams]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.fullName) {
      alert('Please fill in all required fields');
      return;
    }
    
    // Store form data in Zustand store
    setLandingData({
      email: formData.email,
      fullName: formData.fullName,
      dateOfBirth: formData.dateOfBirth,
      dietaryRestrictions: formData.dietaryRestrictions,
      dietaryRestrictionsOther: formData.dietaryRestrictionsOther,
      volunteeringInterests: formData.volunteeringInterests,
      additionalNotes: formData.additionalNotes,
    });
    router.push('/waiver');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#111111] flex flex-col gap-5 items-start justify-center px-5 py-8 rounded-[10px] w-full">
      <h2 className="font-montserrat font-normal text-white text-3xl text-left w-full">
        HELLO
      </h2>
      <p className="font-open-sans font-normal text-white text-base">
        Thank you for being here! We need a few details from you.
      </p>
      
      {/* Form Fields */}
      <div className="flex flex-col gap-5 w-full p-2.5">
        {/* Email Input */}
        <div className="flex gap-2.5 items-start justify-start w-full">
          <div className="flex flex-col gap-1 h-[60px] items-start justify-start">
            <Label className="font-montserrat font-normal text-white text-base text-center">
              Contact Email*
            </Label>
            <Input 
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="hello@example.com"
              className="w-[434px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px]"
              required
            />
          </div>
        </div>
        
        {/* Name and Date of Birth */}
        <div className="flex gap-[120px] items-start justify-start w-full">
          <div className="flex flex-col gap-1 h-[60px] items-start justify-start">
            <Label className="font-montserrat font-normal text-white text-base">
              Legal Name*
            </Label>
            <Input 
              type="text"
              value={formData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              placeholder="Your Name"
              className="w-[434px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px]"
              required
            />
          </div>
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

      {/* Submit Button */}
      <div className="flex justify-center w-full pt-4">
        <Button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-lg font-semibold"
        >
          Continue to Waiver
        </Button>
      </div>
    </form>
  );
}
