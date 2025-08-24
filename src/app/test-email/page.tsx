'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/button';

export default function TestEmailPage() {
  const [isTesting, setIsTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testEmailConfiguration = async () => {
    setIsTesting(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/email', {
        method: 'GET',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email configuration check failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsTesting(false);
    }
  };

  const testWaiverEmail = async () => {
    setIsTesting(true);
    setError(null);
    setResult(null);

    try {
      // First, generate a test PDF to get a real URL
      const pdfResponse = await fetch('/api/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: 'John Doe',
          email: 'kompy@shinydogproductions.com',
          dateOfBirth: '1990-01-01',
          emergencyContact: 'Jane Doe',
          emergencyPhone: '+1234567890',
          signatureImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 transparent PNG
          sessionId: null
        }),
      });

      const pdfData = await pdfResponse.json();

      if (!pdfResponse.ok || !pdfData.success) {
        throw new Error(pdfData.error || 'Failed to generate test PDF');
      }

      // Test data for waiver confirmation email with real PDF URL
      const testData = {
        type: 'waiver-confirmation',
        data: {
          fullName: 'John Doe',
          email: 'kompy@shinydogproductions.com', // You'll need to replace this with a real email for testing
          waiverId: pdfData.waiverId,
          pdfUrl: pdfData.pdfUrl,
          signedAt: new Date().toISOString()
        }
      };

      const response = await fetch('/api/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Email sending failed');
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2d2d2d] p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8 font-montserrat">
          Email Service Test
        </h1>

        <div className="bg-[#111111] p-6 rounded-lg border-[#5c5c5c] mb-6">
          <h2 className="text-2xl font-semibold text-white mb-4 font-montserrat">
            Test Email Configuration
          </h2>
          
          <Button
            onClick={testEmailConfiguration}
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed mr-4"
          >
            {isTesting ? 'Testing...' : 'Check Email Configuration'}
          </Button>

          <Button
            onClick={testWaiverEmail}
            disabled={isTesting}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isTesting ? 'Sending...' : 'Test Waiver Email'}
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
              {result.configured !== undefined && (
                <p><strong>Email Configured:</strong> {result.configured ? 'Yes' : 'No'}</p>
              )}
              {result.messageId && (
                <p><strong>Message ID:</strong> {result.messageId}</p>
              )}
              {result.emailSent !== undefined && (
                <p><strong>Email Sent:</strong> {result.emailSent ? 'Yes' : 'No'}</p>
              )}
              <p><strong>Message:</strong> {result.message}</p>
            </div>
          </div>
        )}

                 <div className="bg-[#111111] p-6 rounded-lg border-[#5c5c5c]">
           <h2 className="text-2xl font-semibold text-white mb-4 font-montserrat">
             Test Instructions
           </h2>
           <div className="text-gray-300 space-y-2">
             <p>1. First, click "Check Email Configuration" to verify Postmark is set up correctly</p>
             <p>2. If configuration is successful, click "Test Waiver Email" to send a test email</p>
             <p>3. The test will first generate a real PDF, then send an email with the PDF attached</p>
             <p>4. Check the console for any errors</p>
             <p>5. Verify that the email is received with the correct content and PDF attachment</p>
             <p><strong>Note:</strong> You'll need to configure your Postmark API key in the environment variables</p>
             <p><strong>Note:</strong> Replace 'test@example.com' with a real email address to test actual delivery</p>
           </div>
         </div>

        <div className="bg-[#111111] p-6 rounded-lg border-[#5c5c5c] mt-6">
          <h2 className="text-2xl font-semibold text-white mb-4 font-montserrat">
            Environment Variables Required
          </h2>
          <div className="text-gray-300 space-y-2">
            <p><code>POSTMARK_API_KEY</code> - Your Postmark API key</p>
            <p><code>POSTMARK_FROM_EMAIL</code> - The email address to send from (optional, defaults to noreply@yourdomain.com)</p>
            <p><code>NEXT_PUBLIC_APP_URL</code> - Your application URL for email links</p>
          </div>
        </div>
      </div>
    </div>
  );
}
