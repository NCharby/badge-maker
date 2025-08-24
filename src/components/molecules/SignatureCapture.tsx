'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/atoms/button';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureCaptureProps {
  value?: string | null;
  onChange?: (signature: string | null) => void;
  className?: string;
}

export function SignatureCapture({ value, onChange, className = '' }: SignatureCaptureProps) {
  const signatureRef = useRef<SignatureCanvas>(null);

  const clearSignature = () => {
    signatureRef.current?.clear();
    onChange?.(null);
  };

  const saveSignature = () => {
    if (signatureRef.current?.isEmpty()) {
      onChange?.(null);
      return;
    }
    
    try {
      // Use toDataURL directly instead of getTrimmedCanvas to avoid webpack issues
      const signatureData = signatureRef.current?.toDataURL('image/png');
      onChange?.(signatureData || null);
    } catch (error) {
      console.error('Error saving signature:', error);
      onChange?.(null);
    }
  };



  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-white rounded-lg p-4 min-h-[200px] border-2 border-dashed border-gray-300">
        <SignatureCanvas
          ref={signatureRef}
          canvasProps={{
            className: 'w-full h-full border-0',
            style: { width: '100%', height: '200px' }
          }}
          backgroundColor="white"
          penColor="black"
          onEnd={saveSignature}
        />
      </div>
      
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearSignature}
            className="border-[#5c5c5c] text-white hover:bg-[#5c5c5c]"
          >
            Clear Signature
          </Button>
          
          <Button
            type="button"
            variant="outline"
            onClick={saveSignature}
            className="border-[#5c5c5c] text-white hover:bg-[#5c5c5c]"
          >
            Save Signature
          </Button>
        </div>
        
        <p className="text-sm text-gray-400">
          {value ? 'Signature captured ✓' : 'Signature required'}
        </p>
      </div>
    </div>
  );
}
