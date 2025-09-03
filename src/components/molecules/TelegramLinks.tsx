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

  const fetchGroupInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      hasAttemptedAutoGeneration.current = false; // Reset auto-generation flag
      
      const response = await fetch(
        `/api/telegram/group-info?eventSlug=${encodeURIComponent(eventSlug)}&sessionId=${encodeURIComponent(sessionId)}`
      );
      
      const data = await response.json();
      
      if (data.success && data.data) {
        setGroupInfo(data.data);
      } else {
        setError(data.error || 'Failed to fetch Telegram information');
      }
    } catch (err) {
      setError('Failed to connect to Telegram service');
    } finally {
      setLoading(false);
    }
  };

  const generatePrivateInvite = async () => {
    try {
      setGeneratingInvite(true);
      setError(null);
      
      const response = await fetch('/api/telegram/generate-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ eventSlug, sessionId }),
      });
      
      const data = await response.json();
      
      if (data.success && data.invite) {
        // Refresh group info to show the new invite
        await fetchGroupInfo();
      } else {
        setError(data.error || 'Failed to generate invite link');
      }
    } catch (err) {
      setError('Failed to generate invite link');
    } finally {
      setGeneratingInvite(false);
    }
  };

  if (loading || generatingInvite) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
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

  if (error || !groupInfo) {
    return null; // Don't show anything if there's an error or no config
  }

  const { config, privateInvite, publicChannel } = groupInfo;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-white font-montserrat text-[24px] font-normal">
          <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.14.18-.357.295-.6.295-.002 0-.003 0-.005 0l.213-3.054 5.56-5.022c.24-.213-.054-.334-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.941z"/>
          </svg>
          <span>Join Our Community</span>
        </CardTitle>
        <CardDescription className="text-[#949494] font-open-sans text-[14px]">
          Connect with other attendees on Telegram
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
                  onClick={() => window.open(privateInvite.inviteLink, '_blank')}
                >
                  <span className="truncate">{privateInvite.inviteLink}</span>
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
