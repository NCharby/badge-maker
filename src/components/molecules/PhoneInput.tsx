'use client';

import { useState } from 'react';
import { Label } from '@/components/atoms/label';
import PhoneInputBase from 'react-phone-number-input/input';

interface PhoneInputProps {
  label?: string;
  placeholder?: string;
  className?: string;
  value?: string;
  onChange?: (value: string | undefined) => void;
  defaultCountry?: string;
}

export function PhoneInput({ 
  label = "Phone Number",
  placeholder = "Enter phone number",
  className = "",
  value,
  onChange,
  defaultCountry = "US"
}: PhoneInputProps) {
  return (
    <div className="flex flex-col gap-1 h-[60px] items-start justify-start">
      <Label className="font-montserrat font-normal text-white text-base">
        {label}
      </Label>
      <div className={`relative ${className}`}>
        <PhoneInputBase
          country={defaultCountry as any}
          value={value}
          onChange={onChange as any}
          placeholder={placeholder}
          className={`
            w-full bg-transparent border border-[#5c5c5c] text-white 
            placeholder:text-[#949494] rounded-[3px] px-3 py-2 h-12
            focus:outline-none focus:border-white
            ${className}
          `}
        />
      </div>
    </div>
  );
}
