'use client';

import { useRef, useEffect } from 'react';
import { Button } from '@/components/atoms/button';
import SignatureCanvas from 'react-signature-canvas';

interface SignatureCaptureProps {
  value?: string | null;
  onChange?: (signature: string | null) => void;
  className?: string;
  isFormValid?: boolean;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

export function SignatureCapture({ 
  value, 
  onChange, 
  className = '', 
  isFormValid = false, 
  onSubmit, 
  isSubmitting = false 
}: SignatureCaptureProps) {
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
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={clearSignature}
            className="border-[#5c5c5c] hover:bg-[#5c5c5c]"
          >
            Clear Signature
          </Button>
          
          <Button
            type="button"
            variant={isFormValid ? "default" : "outline"}
            onClick={() => {
              // Always save signature first, then attempt form submission
              saveSignature();
              // Small delay to ensure signature is saved before validation
              setTimeout(() => {
                onSubmit?.();
              }, 100);
            }}
            disabled={isSubmitting}
            className={`${
              isFormValid 
                ? "bg-blue-600 hover:bg-blue-700 text-white" 
                : "border-[#5c5c5c] hover:bg-[#5c5c5c]"
            } ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            {isSubmitting ? 'Processing...' : 'Sign Waiver & Continue'}
          </Button>
        </div>
        
        <p className="text-sm text-gray-400 text-center sm:text-left">
          {value ? 'Signature captured ✓' : 'Signature required'}
        </p>
      </div>
    </div>
  );
}
