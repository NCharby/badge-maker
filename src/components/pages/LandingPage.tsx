'use client';

import { useRouter } from 'next/navigation';
import { LandingForm } from '@/components/organisms/LandingForm';
import { ProgressSteps } from '@/components/molecules/ProgressSteps';

export function LandingPage() {
  const router = useRouter();

  const handleGetStarted = () => {
    router.push('/waiver');
  };

    return (
    <div className="bg-[#2d2d2d] min-h-screen relative">
      <div className="flex flex-col items-start justify-start relative w-full">
        <div className="relative w-full max-w-7xl mx-auto px-20 py-16">
          {/* Headline */}
          <div className="flex items-center justify-start mb-8">
            <h1 className="font-montserrat font-normal text-white text-6xl text-center">
              BADGE-O-MATIC
            </h1>
          </div>
          
          {/* Main Content */}
          <div className="flex flex-col gap-2.5 w-full">
            {/* Form Section */}
            <div className="flex flex-col gap-2.5 w-full">
              <LandingForm />
            </div>
            
            {/* Progress Steps */}
            <ProgressSteps />
          </div>
        </div>
      </div>
    </div>
  );
}
