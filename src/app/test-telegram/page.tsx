'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { Input } from '@/components/atoms/input';
import { Label } from '@/components/atoms/label';
import { TelegramLinks } from '@/components/molecules/TelegramLinks';

// Generate a UUID for testing
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function TestTelegramPage() {
  const [eventSlug, setEventSlug] = useState('cog-classic-2026');
  const [sessionId, setSessionId] = useState(generateUUID());
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateNewSessionId = () => {
    setSessionId(generateUUID());
  };

  const testBotConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/telegram/test?eventSlug=${encodeURIComponent(eventSlug)}`);
      const data = await response.json();
      setTestResults({ type: 'Comprehensive Test', data });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResults({ type: 'Comprehensive Test', error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const testGroupInfo = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/telegram/group-info?eventSlug=${encodeURIComponent(eventSlug)}&sessionId=${encodeURIComponent(sessionId)}`
      );
      const data = await response.json();
      setTestResults({ type: 'Group Info', data });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResults({ type: 'Group Info', error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const testGenerateInvite = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/telegram/generate-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventSlug, sessionId }),
      });
      const data = await response.json();
      setTestResults({ type: 'Generate Invite', data });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResults({ type: 'Generate Invite', error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  const testBotPermissions = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/telegram/test-bot-permissions?eventSlug=${encodeURIComponent(eventSlug)}`);
      const data = await response.json();
      setTestResults({ type: 'Bot Permissions', data });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResults({ type: 'Bot Permissions', error: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Telegram Integration Test
          </h1>
          <p className="text-gray-600">
            Test the Telegram bot connection, API endpoints, and component functionality
          </p>
        </div>

        {/* Test Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Configuration</CardTitle>
            <CardDescription>
              Configure test parameters and run API tests
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="eventSlug">Event Slug</Label>
                <Input
                  id="eventSlug"
                  value={eventSlug}
                  onChange={(e) => setEventSlug(e.target.value)}
                  placeholder="test-event"
                />
              </div>
              <div>
                <Label htmlFor="sessionId">Session ID</Label>
                <div className="flex space-x-2">
                  <Input
                    id="sessionId"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value)}
                    placeholder="UUID will be auto-generated"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generateNewSessionId}
                    size="sm"
                  >
                    Generate
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex space-x-4 flex-wrap gap-2">
              <Button onClick={testBotConnection} disabled={loading}>
                Comprehensive Test
              </Button>
              <Button onClick={testGroupInfo} disabled={loading}>
                Test Group Info
              </Button>
              <Button onClick={testBotPermissions} disabled={loading}>
                Test Bot Permissions
              </Button>
              <Button onClick={testGenerateInvite} disabled={loading}>
                Test Generate Invite
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Test Results */}
        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>Test Results: {testResults.type}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
                {JSON.stringify(testResults.data || testResults.error, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Component Test */}
        <Card>
          <CardHeader>
            <CardTitle>Component Test</CardTitle>
            <CardDescription>
              Test the TelegramLinks component with the configured parameters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TelegramLinks 
              eventSlug={eventSlug} 
              sessionId={sessionId}
            />
          </CardContent>
        </Card>

        {/* Environment Check */}
        <Card>
          <CardHeader>
            <CardTitle>Environment Check</CardTitle>
            <CardDescription>
              Verify required environment variables are configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>TELEGRAM_BOT_TOKEN:</span>
                <span className="text-yellow-600">
                  Check server logs for status
                </span>
              </div>
              <div className="flex justify-between">
                <span>TELEGRAM_INVITE_EXPIRY_HOURS:</span>
                <span className="text-blue-600">
                  24 (default)
                </span>
              </div>
              <div className="text-sm text-gray-500 mt-2">
                Note: TELEGRAM_BOT_TOKEN is server-side only and cannot be checked from the browser.
                Use the "Comprehensive Test" button to verify configuration.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
