'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/button';

export default function TestPDFPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testPDFGeneration = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      // Test data
      const testData = {
        fullName: 'John Doe',
        email: 'john.doe@example.com',
        dateOfBirth: '1990-01-01',
        emergencyContact: 'Jane Doe',
        emergencyPhone: '+1234567890',
        signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent PNG
        sessionId: null
      };

      const response = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'PDF generation failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 font-montserrat">
          PDF Generation Test
        </h1>

        <div className="bg-[#111111] p-6 rounded-lg border-[#5c5c5c] mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4 font-montserrat">
            Test PDF Generation
          </h2>
          
          <Button
            onClick={testPDFGeneration}
            disabled={isGenerating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating PDF...' : 'Generate Test PDF'}
          </Button>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-500 p-4 rounded-lg mb-6">
            <h3 className="text-red-400 font-semibold mb-2">Error</h3>
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-900/20 border border-green-500 p-4 rounded-lg mb-6">
            <h3 className="text-green-400 font-semibold mb-2">Success!</h3>
            <div className="text-green-300 space-y-2">
              <p><strong>PDF URL:</strong> <a href={result.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{result.pdfUrl}</a></p>
              <p><strong>Waiver ID:</strong> {result.waiverId}</p>
              <p><strong>Message:</strong> {result.message}</p>
            </div>
          </div>
        )}

        <div className="bg-[#111111] p-6 rounded-lg border-[#5c5c5c]">
          <h2 className="text-2xl font-semibold text-white mb-4 font-montserrat">
            Test Instructions
          </h2>
          <div className="text-gray-300 space-y-2">
            <p>1. Click the "Generate Test PDF" button above</p>
            <p>2. The system will create a test PDF with sample data</p>
            <p>3. Check the console for any errors</p>
            <p>4. If successful, you can download the PDF using the provided URL</p>
            <p>5. Verify that the PDF contains all the waiver content and signature</p>
          </div>
        </div>
      </div>
    </div>
  );
}
