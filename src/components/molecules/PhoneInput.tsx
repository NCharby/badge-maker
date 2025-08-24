'use client';

import { useState } from 'react';
import { Label } from '@/components/atoms/label';
import PhoneInputBase from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

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
      <div className="relative w-[434px]">
        <PhoneInputBase
          international
          defaultCountry={defaultCountry}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`w-full ${className}`}
        />
      </div>
    </div>
  );
}
