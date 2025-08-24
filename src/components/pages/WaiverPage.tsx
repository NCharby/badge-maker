'use client';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { useRouter } from 'next/navigation';

export function WaiverPage() {
  const router = useRouter();

  const handleContinue = () => {
    // This will be implemented in Segment 3
    router.push('/badge');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Waiver Signing
          </h1>
          <p className="text-lg text-gray-600">
            Please complete the waiver form to continue to badge creation.
          </p>
        </div>
        
        <Card className="p-8">
          <div className="text-center">
            <h2 className="text-2xl font-semibold mb-4">
              Waiver Form Coming Soon
            </h2>
            <p className="text-gray-600 mb-6">
              This page will contain the complete waiver signing form with digital signature capture.
              It will be implemented in Segment 3: Waiver Form & State Management.
            </p>
            
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">What's Coming:</h3>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• Personal information form</li>
                  <li>• Emergency contact details</li>
                  <li>• Digital signature capture</li>
                  <li>• Terms and conditions</li>
                  <li>• Form validation</li>
                </ul>
              </div>
              
              <Button 
                onClick={handleContinue}
                className="mt-4"
              >
                Continue to Badge Creation (Skip for now)
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
