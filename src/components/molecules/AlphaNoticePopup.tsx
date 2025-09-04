'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { X, AlertTriangle } from 'lucide-react';

export function AlphaNoticePopup() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed the popup
    const hasSeenNotice = localStorage.getItem('alpha-notice-dismissed');
    if (!hasSeenNotice) {
      setIsVisible(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('alpha-notice-dismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#1a1a1a] border-[#5c5c5c] max-w-md w-full p-6 relative">
        <Button
          onClick={handleDismiss}
          variant="ghost"
          size="sm"
          className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 h-auto"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-white font-montserrat mb-2">
              Alpha Software Notice
            </h3>
            <div className="text-gray-300 text-sm space-y-3 font-open-sans">
              <p>
                This is alpha software and may experience issues. If anything goes wrong during your badge creation process, please don't worry!
              </p>
              <p>
                <strong>Your registration has already been captured</strong> and we will follow up with you to collect your badge information manually if needed.
              </p>
              <p>
                For any issues or questions, please contact us at:
                <br />
                <a 
                  href="mailto:hello@shinydogproductions.com" 
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  hello@shinydogproductions.com
                </a>
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <Button
            onClick={handleDismiss}
            className="bg-blue-600 hover:bg-blue-700 text-white font-montserrat"
          >
            Let's Do This!
          </Button>
        </div>
      </Card>
    </div>
  );
}
