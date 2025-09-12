'use client';

import { useState, useEffect, useRef } from 'react';
import { TelegramGroupInfo, TelegramInvite } from '@/types/telegram';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { ExternalLink, Users, MessageCircle } from 'lucide-react';

interface TelegramLinksProps {
  eventSlug: string;
  sessionId: string;
  className?: string;
}

export function TelegramLinks({ eventSlug, sessionId, className }: TelegramLinksProps) {
  const [groupInfo, setGroupInfo] = useState<TelegramGroupInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const hasAttemptedAutoGeneration = useRef(false);

  // Helper function to safely convert date strings to Date objects
  const safeDate = (dateValue: Date | string): Date => {
    return dateValue instanceof Date ? dateValue : new Date(dateValue);
  };

  // Helper function to calculate hours until expiration
  const getHoursUntilExpiry = (expiresAt: Date | string): number => {
    const expiryDate = safeDate(expiresAt);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60));
  };

  // Helper function to convert technical error messages to user-friendly ones
  const getUserFriendlyErrorMessage = (errorMessage: string): string => {
    const errorMap: Record<string, string> = {
      'Telegram integration not configured for this event': 'Telegram is not available for this event',
      'Failed to generate invite link': 'Unable to create your invite link. Please try again.',
      'TELEGRAM_BOT_TOKEN not configured in environment': 'Telegram service is temporarily unavailable',
      'Telegram private group not configured for this event': 'Private group is not set up for this event',
      'Event not found': 'Event configuration not found',
      'Failed to store invite link in database': 'Invite created but failed to save. Please try again.',
      'Network error occurred': 'Connection failed. Please check your internet and try again.',
      'Failed to connect to Telegram service': 'Unable to reach Telegram service. Please try again.'
    };

    // Return user-friendly message if found, otherwise return a generic one
    return errorMap[errorMessage] || 'Something went wrong. Please try again.';
  };

  useEffect(() => {
    fetchGroupInfo();
  }, [eventSlug, sessionId]);

  // Auto-generate invite if none exists
  useEffect(() => {
    if (groupInfo && !groupInfo.privateInvite && !generatingInvite && !loading && !hasAttemptedAutoGeneration.current) {
      hasAttemptedAutoGeneration.current = true;
      // Small delay to ensure smooth UX
      setTimeout(() => {
        generatePrivateInvite();
      }, 500);
    }
  }, [groupInfo, generatingInvite, loading]);

  // Retry mechanism for failed auto-generation
  const retryAutoGeneration = () => {
    hasAttemptedAutoGeneration.current = false;
    // Reset error and try again
    setError(null);
    // Small delay before retry
    setTimeout(() => {
      generatePrivateInvite();
    }, 1000);
  };

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      hasAttemptedAutoGeneration.current = false; // Reset auto-generation flag
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(
        `/api/telegram/group-info?eventSlug=${encodeURIComponent(eventSlug)}&sessionId=${encodeURIComponent(sessionId)}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setGroupInfo(data.data);
      } else {
        const errorMessage = data.error || 'Failed to fetch Telegram information';
        setError(getUserFriendlyErrorMessage(errorMessage));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to Telegram service';
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        setError(getUserFriendlyErrorMessage(errorMessage));
      }
    } finally {
      setLoading(false);
    }
  };

  const generatePrivateInvite = async () => {
    try {
      setGeneratingInvite(true);
      setError(null);
      
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout for invite generation
      
      const response = await fetch('/api/telegram/generate-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventSlug, sessionId }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (data.success && data.invite) {
        // Refresh group info to show the new invite
        await fetchGroupInfo();
      } else {
        // Provide more specific error messages
        const errorMessage = data.error || 'Failed to generate invite link';
        setError(getUserFriendlyErrorMessage(errorMessage));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Request timed out. Please try again.');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Network error occurred';
        setError(getUserFriendlyErrorMessage(errorMessage));
      }
    } finally {
      setGeneratingInvite(false);
    }
  };

  if (loading || generatingInvite) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 px-0 pb-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-[#949494] font-open-sans text-[14px]">
              {loading ? 'Loading Telegram information...' : 'Generating your invite link...'}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle errors gracefully
  if (error) {
    return (
      <Card className={className}>
        <CardHeader className="px-0 py-6">
          <CardTitle className="flex items-center space-x-2 text-white font-montserrat text-[20px] font-normal">
            <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
            </svg>
            <span>Telegram Unavailable</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-6 pt-0">
          <div className="space-y-3">
            <p className="text-[#949494] font-open-sans text-[14px]">
              {error}
            </p>
            <div className="flex space-x-3">
              <Button
                onClick={retryAutoGeneration}
                className="bg-[#767676] text-black font-open-sans text-[14px] rounded-[3px] hover:bg-[#949494]"
              >
                Retry
              </Button>
              <Button
                onClick={fetchGroupInfo}
                className="bg-[#767676] text-black font-open-sans text-[14px] rounded-[3px] hover:bg-[#949494]"
              >
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={() => setError(null)}
                className="bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle case where no group info is available
  if (!groupInfo) {
    return (
      <Card className={className}>
        <CardHeader className="px-0 py-6">
          <CardTitle className="flex items-center space-x-2 text-white font-montserrat text-[20px] font-normal">
            <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
            </svg>
            <span>Telegram Not Configured</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-6 pt-0">
          <div className="space-y-3">
            <p className="text-[#949494] font-open-sans text-[14px]">
              Telegram integration is not configured for this event. Contact the event organizers for more information.
            </p>
            <Button
              onClick={fetchGroupInfo}
              className="bg-[#767676] text-black font-open-sans text-[14px] rounded-[3px] hover:bg-[#949494]"
            >
              Check Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { config, privateInvite, publicChannel } = groupInfo;

  return (
    <Card className={className}>
      <CardHeader className="px-0 py-6">
        <CardTitle className="flex items-center space-x-2 text-white font-montserrat text-[24px] font-normal">
          <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
          </svg>
          <span>Join The Chat</span>
        </CardTitle>
        <CardDescription className="text-[#949494] font-open-sans text-[14px]">
          Connect with other attendees on Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-0 pb-6 pt-0">
        {/* Private Group */}
        {config.privateGroupId && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-white font-open-sans text-[16px] font-medium">
                {config.groupName || 'Private Group'}
              </span>
            </div>
            
            {privateInvite ? (
              <div className="space-y-3">
                <p className="text-[#949494] font-open-sans text-[14px]">
                  Your personal invite link (expires in {getHoursUntilExpiry(privateInvite.expiresAt)} hours)
                </p>
                <Button
                  variant="outline"
                  className="w-full justify-between bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
                  onClick={() => window.open("https://t.me/+23KS1loL6c81MDEx", '_blank')}
                >
                  <span className="truncate">https://t.me/+23KS1loL6c81MDEx</span>
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-[#949494] font-open-sans text-[14px]">
                  Generate your personal invite link to join the private group
                </p>
                <Button
                  onClick={generatePrivateInvite}
                  disabled={generatingInvite}
                  className="w-full bg-[#767676] text-black font-open-sans text-[14px] rounded-[3px] hover:bg-[#949494]"
                >
                  {generatingInvite ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    'Generate Invite Link'
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Public Channel */}
        {publicChannel && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-green-400" />
              <span className="text-white font-open-sans text-[16px] font-medium">
                {publicChannel.name}
              </span>
            </div>
            <p className="text-[#949494] font-open-sans text-[14px]">
              Join our public channel for announcements and updates
            </p>
            <Button
              variant="outline"
              className="w-full justify-between bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
              onClick={() => window.open(publicChannel.url, '_blank')}
            >
              <span className="truncate">{publicChannel.url}</span>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Description */}
        {config.description && (
          <p className="text-[#949494] font-open-sans text-[14px] pt-3 border-t border-[#5c5c5c]">
            {config.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
