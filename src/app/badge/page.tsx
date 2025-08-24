'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCreationForm } from '@/components/organisms/BadgeCreationForm';
import { BadgeMakerTemplate } from '@/components/templates/BadgeMakerTemplate';
import { useUserFlowStore } from '@/hooks/useUserFlowStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/atoms/card';
import { Button } from '@/components/atoms/button';

export default function BadgePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [waiverData, setWaiverData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { email, fullName, waiverId } = useUserFlowStore();

  useEffect(() => {
    checkWaiverStatus();
  }, []);

  const checkWaiverStatus = async () => {
    try {
      // Check if user has completed waiver by looking for waiver data in store
      if (!email || !fullName) {
        // No waiver data found, redirect to landing page
        router.push('/landing');
        return;
      }

      // Check if waiver was actually completed by querying the database
      const response = await fetch(`/api/pdf?waiverId=${waiverId || 'check'}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.waiver) {
          setWaiverData(data.waiver);
          setIsLoading(false);
        } else {
          // No waiver found, redirect to landing
          router.push('/landing');
        }
      } else {
        // Error checking waiver, redirect to landing
        router.push('/landing');
      }
    } catch (error) {
      console.error('Error checking waiver status:', error);
      setError('Failed to verify waiver status');
      setIsLoading(false);
    }
  };

  const handleBackToWaiver = () => {
    router.push('/waiver');
  };

  if (isLoading) {
    return (
      <BadgeMakerTemplate>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
            <p className="text-white text-lg">Verifying waiver status...</p>
          </div>
        </div>
      </BadgeMakerTemplate>
    );
  }

  if (error) {
    return (
      <BadgeMakerTemplate>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="bg-[#111111] border-[#5c5c5c] max-w-md">
            <CardHeader>
              <CardTitle className="text-white text-xl">Error</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-300">{error}</p>
              <div className="flex gap-3">
                <Button onClick={handleBackToWaiver} variant="outline">
                  Back to Waiver
                </Button>
                <Button onClick={() => router.push('/landing')}>
                  Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </BadgeMakerTemplate>
    );
  }

  return (
    <BadgeMakerTemplate>
      <div className="mb-8">
        <Card className="bg-[#111111] border-[#5c5c5c]">
          <CardHeader>
            <CardTitle className="text-white text-xl">Waiver Completed ✅</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-gray-300 space-y-2">
              <p><strong>Name:</strong> {waiverData?.fullName || fullName}</p>
              <p><strong>Email:</strong> {waiverData?.email || email}</p>
              <p><strong>Waiver ID:</strong> {waiverData?.id || waiverId}</p>
              <p><strong>Signed:</strong> {new Date(waiverData?.signedAt || Date.now()).toLocaleDateString()}</p>
            </div>
            <div className="mt-4 p-3 bg-green-900/20 border border-green-500 rounded">
              <p className="text-green-300 text-sm">
                Your waiver has been successfully completed and is on file. You can now proceed to create your event badge.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <BadgeCreationForm />
    </BadgeMakerTemplate>
  );
}
