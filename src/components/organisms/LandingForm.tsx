'use client';

import { useState } from 'react';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { DateOfBirthInput } from '@/components/molecules/DateOfBirthInput';
import { PhoneInput } from '@/components/molecules/PhoneInput';

export function LandingForm() {
  const [emergencyPhone, setEmergencyPhone] = useState<string>();

  return (
    <div className="bg-[#111111] flex flex-col gap-5 items-start justify-center px-5 py-8 rounded-[10px] w-full">
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
              placeholder="hello@example.com"
              className="w-[434px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px]"
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
              placeholder="Your Name"
              className="w-[434px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px]"
            />
          </div>
          <DateOfBirthInput />
        </div>
        
        {/* Emergency Contact */}
        <div className="flex gap-[120px] items-start justify-start w-full">
          <div className="flex flex-col gap-1 h-[60px] items-start justify-start">
            <Label className="font-montserrat font-normal text-white text-base">
              Emergency Contact
            </Label>
            <Input 
              type="text"
              placeholder="Contact Name"
              className="w-[434px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px]"
            />
          </div>
          <PhoneInput
            label="Emergency Phone"
            placeholder="Enter emergency phone number"
            value={emergencyPhone}
            onChange={setEmergencyPhone}
            defaultCountry="US"
          />
        </div>
      </div>
    </div>
  );
}
