'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/atoms/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/atoms/card';
import { ExternalLink, Users, MessageCircle } from 'lucide-react';

interface TelegramConfig {
  enabled: boolean;
  privateGroupId?: string;
  publicChannel?: string;
  groupName?: string;
  channelName?: string;
  description?: string;
  inviteLink?: string;
  inviteExpiresAt?: string;
  inviteCreatedAt?: string;
}

interface TelegramLinksProps {
  eventSlug: string;
  sessionId: string;
  className?: string;
}

export function TelegramLinks({ eventSlug, sessionId, className }: TelegramLinksProps) {
  const [config, setConfig] = useState<TelegramConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to calculate hours until expiration
  const getHoursUntilExpiry = (expiresAt: string): number => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    const diffMs = expiryDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60));
  };

  useEffect(() => {
    fetchTelegramConfig();
  }, [eventSlug]);

  const fetchTelegramConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/events/${eventSlug}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.event?.telegram_config) {
          setConfig(data.event.telegram_config);
        } else {
          setConfig(null);
        }
      } else {
        setError('Failed to load Telegram configuration');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 px-0 pb-6">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
            <span className="text-[#949494] font-open-sans text-[14px]">
              Loading Telegram information...
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
            <Button
              onClick={fetchTelegramConfig}
              className="bg-[#767676] text-black font-open-sans text-[14px] rounded-[3px] hover:bg-[#949494]"
            >
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no telegram config is available, don't render anything
  if (!config || !config.enabled || (!config.inviteLink && !config.publicChannel)) {
    return null;
  }

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
        {/* Private Group - Per-Event Invite */}
        {config.inviteLink && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-white font-open-sans text-[16px] font-medium">
                {config.groupName || 'Private Group'}
              </span>
            </div>
            
            <div className="space-y-3">
              <p className="text-[#949494] font-open-sans text-[14px]">
                Event invite link{config.inviteExpiresAt ? ` (expires in ${getHoursUntilExpiry(config.inviteExpiresAt)} hours)` : ''}
              </p>
              <Button
                variant="outline"
                className="w-full justify-between bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
                onClick={() => window.open(config.inviteLink, '_blank')}
              >
                <span className="truncate">{config.inviteLink}</span>
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Public Channel */}
        {config.publicChannel && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <MessageCircle className="w-4 h-4 text-green-400" />
              <span className="text-white font-open-sans text-[16px] font-medium">
                {config.channelName || 'Public Channel'}
              </span>
            </div>
            <p className="text-[#949494] font-open-sans text-[14px]">
              Join our public channel for announcements and updates
            </p>
            <Button
              variant="outline"
              className="w-full justify-between bg-transparent border-[#767676] text-white font-open-sans text-[14px] rounded-[3px] hover:bg-[#767676] hover:text-black"
              onClick={() => window.open(config.publicChannel, '_blank')}
            >
              <span className="truncate">{config.publicChannel}</span>
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
