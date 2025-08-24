'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { Calendar } from '@/components/atoms/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover';
import { CalendarIcon } from 'lucide-react';

function formatDate(date: Date | undefined) {
  if (!date) {
    return ""
  }

  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false
  }
  return !isNaN(date.getTime())
}

export function DateOfBirthInput() {
  const defaultDate = new Date('2000-01-01');
  const [dateOfBirth, setDateOfBirth] = useState<Date>(defaultDate);
  const [dateOfBirthOpen, setDateOfBirthOpen] = useState(false);
  const [dateOfBirthMonth, setDateOfBirthMonth] = useState<Date>(defaultDate);
  const [dateOfBirthValue, setDateOfBirthValue] = useState(formatDate(defaultDate));

  return (
    <div className="flex flex-col gap-1 h-[60px] items-start justify-start">
      <Label className="font-montserrat font-normal text-white text-base">
        Date of birth
      </Label>
      <div className="relative flex gap-2">
        <Input
          value={dateOfBirthValue}
          placeholder="Select your date of birth"
          className="w-[434px] bg-transparent border-[#5c5c5c] text-white placeholder:text-[#949494] rounded-[3px] pr-10"
          onChange={(e) => {
            const date = new Date(e.target.value)
            setDateOfBirthValue(e.target.value)
            if (isValidDate(date)) {
              setDateOfBirth(date)
              setDateOfBirthMonth(date)
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setDateOfBirthOpen(true)
            }
          }}
        />
        <Popover open={dateOfBirthOpen} onOpenChange={setDateOfBirthOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2 bg-transparent hover:bg-transparent p-0"
            >
              <CalendarIcon className="size-3.5 text-[#949494]" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0 bg-[#2d2d2d] border-[#5c5c5c]"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={dateOfBirth}
              captionLayout="dropdown"
              month={dateOfBirthMonth}
              onMonthChange={setDateOfBirthMonth}
              onSelect={(date) => {
                if (date) {
                  setDateOfBirth(date)
                  setDateOfBirthValue(formatDate(date))
                  setDateOfBirthOpen(false)
                }
              }}
              className="bg-[#2d2d2d] text-white [&_.rdp-button]:text-white [&_.rdp-button]:hover:bg-[#5c5c5c] [&_.rdp-button]:focus:bg-[#5c5c5c] [&_.rdp-button_selected]:bg-blue-600 [&_.rdp-button_selected]:text-white [&_.rdp-button_selected]:hover:bg-blue-700 [&_.rdp-head_cell]:text-white [&_.rdp-caption]:text-white [&_.rdp-nav_button]:text-white [&_.rdp-nav_button]:hover:bg-[#5c5c5c] [&_.rdp-dropdown]:bg-[#2d2d2d] [&_.rdp-dropdown]:text-white [&_.rdp-dropdown]:border-[#5c5c5c]"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
