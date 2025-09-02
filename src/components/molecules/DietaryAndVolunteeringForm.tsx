'use client';

import { useState } from 'react';
import { Label } from '@/components/atoms/label';
import { Input } from '@/components/atoms/input';

interface DietaryAndVolunteeringFormProps {
  dietaryRestrictions: string[];
  dietaryRestrictionsOther: string;
  volunteeringInterests: string[];
  additionalNotes: string;
  onDietaryRestrictionsChange: (restrictions: string[]) => void;
  onDietaryRestrictionsOtherChange: (other: string) => void;
  onVolunteeringInterestsChange: (interests: string[]) => void;
  onAdditionalNotesChange: (notes: string) => void;
}

const dietaryOptions = [
  'Vegetarian',
  'Vegan',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Soy-Free',
  'Shellfish-Free',
  'Kosher',
  'Halal',
  'Paleo',
  'Low-Carb',
  'Low-Sodium',
  'Diabetic-Friendly',
  'Pescatarian',
  'Egg-Free',
  'Corn-Free',
  'FODMAP-Friendly',
  'Nightshade-Free',
  'Keto',
  'Sugar-Free',
  'Lactose-Intolerant',
  'Alcohol-Free',
  'Organic-Only',
  'OTHER (Please tell us more)'
];

const volunteeringOptions = [
  'Set-Up',
  'Tear-Down',
  'Registration',
  'Playspace',
  'Music',
  'Food',
  'Anywhere! Happy to Help!'
];

export function DietaryAndVolunteeringForm({
  dietaryRestrictions,
  dietaryRestrictionsOther,
  volunteeringInterests,
  additionalNotes,
  onDietaryRestrictionsChange,
  onDietaryRestrictionsOtherChange,
  onVolunteeringInterestsChange,
  onAdditionalNotesChange
}: DietaryAndVolunteeringFormProps) {
  
  const handleDietaryRestrictionChange = (restriction: string, checked: boolean) => {
    if (checked) {
      onDietaryRestrictionsChange([...dietaryRestrictions, restriction]);
    } else {
      onDietaryRestrictionsChange(dietaryRestrictions.filter(r => r !== restriction));
    }
  };

  const handleVolunteeringInterestChange = (interest: string, checked: boolean) => {
    if (checked) {
      onVolunteeringInterestsChange([...volunteeringInterests, interest]);
    } else {
      onVolunteeringInterestsChange(volunteeringInterests.filter(i => i !== interest));
    }
  };

  return (
    <div className="space-y-8">
      {/* Dietary Restrictions Section */}
      <div className="space-y-4">
        <Label className="font-montserrat font-normal text-white text-base">
          Dietary Restrictions
        </Label>
        <div className="grid grid-cols-2 gap-4">
          {dietaryOptions.map((option) => (
            <div key={option} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`dietary-${option}`}
                checked={dietaryRestrictions.includes(option)}
                onChange={(e) => handleDietaryRestrictionChange(option, e.target.checked)}
                className="w-4 h-4 text-white bg-transparent border-[#5c5c5c] rounded focus:ring-white focus:ring-2"
              />
              <Label 
                htmlFor={`dietary-${option}`} 
                className="text-white font-open-sans text-sm cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
        
        {/* Other Dietary Restrictions Text Input */}
        {dietaryRestrictions.includes('OTHER (Please tell us more)') && (
          <div className="mt-4">
            <Input
              type="text"
              value={dietaryRestrictionsOther}
              onChange={(e) => onDietaryRestrictionsOtherChange(e.target.value)}
              placeholder="Please specify your dietary restrictions..."
              className="w-full bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] h-12"
            />
          </div>
        )}
      </div>

      {/* Volunteering Interests Section */}
      <div className="space-y-4">
        <Label className="font-montserrat font-normal text-white text-base">
          Are you interested in volunteering?
        </Label>
        <div className="grid grid-cols-2 gap-4">
          {volunteeringOptions.map((option) => (
            <div key={option} className="flex items-center space-x-3">
              <input
                type="checkbox"
                id={`volunteering-${option}`}
                checked={volunteeringInterests.includes(option)}
                onChange={(e) => handleVolunteeringInterestChange(option, e.target.checked)}
                className="w-4 h-4 text-white bg-transparent border-[#5c5c5c] rounded focus:ring-white focus:ring-2"
              />
              <Label 
                htmlFor={`volunteering-${option}`} 
                className="text-white font-open-sans text-sm cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Notes Section */}
      <div className="space-y-4">
        <Label className="font-montserrat font-normal text-white text-base">
          Anything else we should know?
        </Label>
        <textarea
          value={additionalNotes}
          onChange={(e) => onAdditionalNotesChange(e.target.value)}
          placeholder="Any additional information, special requests, or notes..."
          className="w-full bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] min-h-[100px] resize-none p-3 font-open-sans text-sm"
        />
      </div>
    </div>
  );
}
