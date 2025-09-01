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
      <div className={`relative ${className}`}>
        <PhoneInputBase
          international
          defaultCountry={defaultCountry as any}
          value={value}
          onChange={onChange as any}
          placeholder={placeholder}
          className={`
            w-full bg-transparent border border-[#5c5c5c] text-white 
            placeholder:text-[#949494] rounded-[3px] px-3 py-2
            focus:outline-none focus:border-white
            [&_.PhoneInputCountry]:text-white
            [&_.PhoneInputCountrySelect]:bg-transparent
            [&_.PhoneInputCountrySelect]:text-white
            [&_.PhoneInputCountrySelect]:border-none
            [&_.PhoneInputCountrySelect]:outline-none
            [&_.PhoneInputCountrySelectArrow]:text-[#949494]
            [&_.PhoneInputInput]:bg-transparent
            [&_.PhoneInputInput]:text-white
            [&_.PhoneInputInput]:border-none
            [&_.PhoneInputInput]:outline-none
            [&_.PhoneInputInput]:placeholder:text-[#949494]
            [&_.PhoneInputCountrySelect__option]:text-white
            [&_.PhoneInputCountrySelect__option]:bg-[#2d2d2d]
            [&_.PhoneInputCountrySelect__option--selected]:bg-[#5c5c5c]
            [&_.PhoneInputCountrySelect__option--selected]:text-white
            [&_.PhoneInputCountrySelect__option--focused]:bg-[#5c5c5c]
            [&_.PhoneInputCountrySelect__option--focused]:text-white
            ${className}
          `}
        />
      </div>
    </div>
  );
}
